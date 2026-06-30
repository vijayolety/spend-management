import { Logger } from '@nestjs/common';
import { IntegrationProvider } from '../provider.interface';

// Railway GraphQL API v2 — https://docs.railway.com/reference/public-api
// Rate limits: 1000 RPH / 10 RPS (Hobby) · 10000 RPH / 50 RPS (Pro)
// Internal limit: 16 concurrent usage queries per client
//
// Key insight: estimatedUsage fans out to (N_projects × N_measurements) concurrent
// internal queries. Fix: query ONE project at a time sequentially with 4 measurements
// = 4 concurrent internal queries per call, well under the 16-query limit.
const RAILWAY_GQL = 'https://backboard.railway.app/graphql/v2';

// Path A — direct dollar total; requires workspace owner / billing scope.
// No internal metric queries triggered — always try this first.
const BILLING_QUERY = `
  query {
    me {
      workspaces {
        customer {
          currentUsage
        }
      }
    }
  }
`;

// Path B — list every project the token can see.
// Works for personal tokens (all projects) and project-scoped tokens (one project).
const PROJECTS_QUERY = `
  query {
    projects {
      edges {
        node {
          id
        }
      }
    }
  }
`;

// Path C — resource usage for a single project, converted to USD.
// estimatedValue is in resource-unit-minutes (vCPU-min, GB-min) — NOT dollars.
// Apply Railway's per-minute rates to get cost:
//   CPU:  $20/vCPU/month  → / (30×24×60)
//   MEM:  $10/GB/month    → / (30×24×60)
//   DISK: $0.15/GB/month  → / (30×24×60)
//   NET:  $0.05/GB egress → flat per GB (not per-minute)
const MINUTES_PER_MONTH = 30 * 24 * 60; // 43 200
const RATES: Record<string, number> = {
  CPU_USAGE:       20    / MINUTES_PER_MONTH,
  MEMORY_USAGE_GB: 10    / MINUTES_PER_MONTH,
  DISK_USAGE_GB:    0.15 / MINUTES_PER_MONTH,
  NETWORK_TX_GB:    0.05,   // $/GB flat — already total GB, not per-minute
};

const PROJECT_USAGE_QUERY = (projectId: string) => `
  query {
    estimatedUsage(
      projectId: "${projectId}"
      measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB]
    ) {
      estimatedValue
      measurement
    }
  }
`;

const RATE_LIMIT_RE = /too many (metric|usage) queries/i;
const NOT_AUTHORIZED_RE = /not authorized/i;

// Fetches compute & agent usage limits from the workspace the token belongs to.
// Returns null when the token is project-scoped and cannot read workspace billing.
const WORKSPACE_LIMITS_QUERY = `
  query {
    projects {
      edges {
        node {
          workspace {
            customer {
              usageLimit {
                hardLimit
                softLimit
                agentHardLimitCents
                agentSoftLimitCents
              }
            }
          }
        }
      }
    }
  }
`;

export interface RailwayUsageLimits {
  computeHardLimitUSD: number;  // hard limit on compute ($)
  computeSoftLimitUSD: number;  // email-alert threshold ($)
  agentHardLimitUSD: number;    // agent hard limit ($)
  agentSoftLimitUSD: number;    // agent alert threshold ($)
}

export class RailwayProvider implements IntegrationProvider {
  private readonly logger = new Logger(RailwayProvider.name);

  async fetchLimitsUSD(config: Record<string, any>): Promise<RailwayUsageLimits | null> {
    const { apiToken } = config;
    if (!apiToken) return null;

    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` };
    const json = await this.gql(h, WORKSPACE_LIMITS_QUERY);
    if (this.firstError(json)) return null;

    const first = json?.data?.projects?.edges?.[0]?.node?.workspace?.customer?.usageLimit;
    if (!first) return null;

    return {
      computeHardLimitUSD:  first.hardLimit  ?? 0,
      computeSoftLimitUSD:  first.softLimit   ?? 0,
      agentHardLimitUSD:    (first.agentHardLimitCents ?? 0) / 100,
      agentSoftLimitUSD:    (first.agentSoftLimitCents ?? 0) / 100,
    };
  }

  async fetchSpendUSD(config: Record<string, any>): Promise<number> {
    const { apiToken } = config;
    if (!apiToken) throw new Error('Railway config missing apiToken');

    const h = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    };

    // ── Path A: direct billing (workspace owner tokens) ───────────────────────
    const billingJson = await this.gql(h, BILLING_QUERY);
    const billingErr = this.firstError(billingJson);

    if (!billingErr) {
      const workspaces: any[] = billingJson?.data?.me?.workspaces ?? [];
      return workspaces.reduce(
        (sum: number, ws: any) => sum + (ws?.customer?.currentUsage ?? 0),
        0,
      );
    }

    if (!NOT_AUTHORIZED_RE.test(billingErr)) {
      throw new Error(billingErr);
    }

    this.logger.log('customer.currentUsage not authorized — switching to per-project estimatedUsage');

    // ── Path B: get project IDs ───────────────────────────────────────────────
    const projectsJson = await this.gql(h, PROJECTS_QUERY);
    const projectsErr = this.firstError(projectsJson);

    if (projectsErr && NOT_AUTHORIZED_RE.test(projectsErr)) {
      throw new Error(
        'Railway API token does not have permission to read projects or billing data. ' +
          'Use a personal API token from railway.com → Account Settings → API Tokens.',
      );
    }
    if (projectsErr) throw new Error(projectsErr);

    const edges: any[] = projectsJson?.data?.projects?.edges ?? [];
    const projectIds: string[] = edges
      .map((e: any) => e?.node?.id)
      .filter(Boolean);

    if (projectIds.length === 0) {
      this.logger.warn('Railway: no projects found for this token — returning 0');
      return 0;
    }

    this.logger.log(`Railway: summing estimatedUsage across ${projectIds.length} project(s) sequentially`);

    // ── Path C: per-project usage — sequential to stay under rate limit ───────
    let total = 0;
    for (const projectId of projectIds) {
      total += await this.projectUsage(h, projectId);
    }
    return total;
  }

  private async projectUsage(
    h: Record<string, string>,
    projectId: string,
    attempt = 1,
  ): Promise<number> {
    const resp = await fetch(RAILWAY_GQL, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ query: PROJECT_USAGE_QUERY(projectId) }),
    });

    const retryAfterHeader = resp.headers.get('Retry-After');
    const json = (await resp.json()) as any;
    const errMsg = this.firstError(json);

    if (errMsg) {
      if (RATE_LIMIT_RE.test(errMsg) && attempt === 1) {
        // Railway reports its retry window; wait the minimum of that or 8 s
        const waitMs = retryAfterHeader
          ? Math.min(Number(retryAfterHeader) * 1000, 8_000)
          : 6_000;
        this.logger.warn(
          `Railway rate limit on project ${projectId} (attempt ${attempt}) — retrying in ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        return this.projectUsage(h, projectId, 2);
      }

      if (RATE_LIMIT_RE.test(errMsg)) {
        // Still rate-limited after retry — skip this project, don't fail the whole sync
        this.logger.warn(
          `Railway rate limit persists for project ${projectId} — skipping, will catch on next sync`,
        );
        return 0;
      }

      // Any other error on a single project — log and skip rather than failing everything
      this.logger.error(`Railway estimatedUsage error for project ${projectId}: ${errMsg}`);
      return 0;
    }

    const items: any[] = json?.data?.estimatedUsage ?? [];
    let subtotal = 0;
    for (const item of items) {
      const rate = RATES[item.measurement as string] ?? 0;
      subtotal += (item.estimatedValue ?? 0) * rate;
    }
    this.logger.log(`Railway project ${projectId}: $${subtotal.toFixed(4)} USD`);
    return subtotal;
  }

  private async gql(h: Record<string, string>, query: string): Promise<any> {
    const resp = await fetch(RAILWAY_GQL, { method: 'POST', headers: h, body: JSON.stringify({ query }) });
    return resp.json();
  }

  private firstError(json: any): string | null {
    return json?.errors?.[0]?.message ?? null;
  }
}
