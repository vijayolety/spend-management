# Hostinger Subscription Integration — Loop Engineering Prompt + Definition of Done

## Context

Hostinger here means the same thing Namecheap and Google Workspace do: a **flat-fee
subscription tracked manually**, not a live spend-metered API integration —
with one wrinkle Namecheap and Google Workspace didn't have: Hostinger's cadence
is **monthly**, which the `billingCycle` field (built for Namecheap's yearly
case, `apps/api/prisma/schema.prisma`) already defaults to and fully supports
end-to-end (rollover, renewal reminders, dashboard "/ mo" labels, Billing
History). That means this integration needs **no schema or scheduler changes
at all** - it's strictly narrower in scope than the Namecheap loop.

---

## Step 0 — confirm this is manual-only (don't skip)

Unlike Namecheap (confirmed API-less for billing), Hostinger **does** publish
a real public Billing API (`hostinger/api` on GitHub, OpenAPI-documented at
developers.hostinger.com, Bearer-token auth) with a
`GET /api/billing/v1/subscriptions` endpoint. This is a materially different
starting point from Namecheap and deserves an honest note, not a copy-pasted
"no API exists" conclusion:

- The subscription list/get endpoints are documented as reporting **status
  metadata** - `expires_at`, `is_auto_renewed` - i.e. "is this still active
  and when does it renew," not a spend/cost figure. A separate "Price"
  resource exists but reads as a pricing **catalog** (what a plan costs to
  purchase), not "what did I actually pay for my subscription."
- Multiple independent research passes (DeepWiki, the raw OpenAPI spec, GitHub
  code search) were unable to confirm or rule out a price/amount field on the
  Subscription object itself - the full `components.schemas` section couldn't
  be retrieved in this pass.
- Building a real `IntegrationProvider` against an unverified schema, with no
  real API token available to test against, would repeat the exact mistake
  this project's process is built to avoid (see GCP's provider explicitly
  shipping without a per-project breakdown because the export schema hadn't
  been verified against a live table yet - "unverified-schema code" kept out
  of the shipped path on purpose).

**Conclusion: manual entry, same as Namecheap/Google Workspace.** If a future
pass gets real API-token access and confirms the Subscription (or Price)
resource does return a genuine per-subscription cost, that's grounds to
revisit this as a live `IntegrationProvider` - a separate, larger task
following the Railway/Claude/GCP pattern in
`apps/api/src/integrations/providers/`, not a change to this manual entry.

---

## Loop Engineering Prompt

```
GOAL
Add Hostinger as a known manual-subscription vendor (Vendor dropdown
convenience only, same as Namecheap/Google Workspace), then create the user's
real Hostinger tool: monthly plan, ₹399/month, renews 12 Sep 2026.

STEP 1 — FRONTEND: KNOWN VENDOR ENTRY
File: apps/web/src/lib/integration-providers.ts
Add one entry to INTEGRATION_PROVIDERS:
  { value: 'HOSTINGER', label: 'Hostinger', vendor: 'Hostinger', hasApi: false,
    tokenKey: '', tokenLabel: '', placeholder: '', helpText: '',
    hasLimits: false, defaultPaymentKind: 'MOSUB', defaultBillingCycle: 'MONTHLY' }
This is purely a dropdown convenience (prefills Vendor + Payment type +
Billing cycle when picked) - it never appears as a live integration, matches
the existing Namecheap/Google Workspace entries exactly. Do NOT add anything
to apps/api/src/integrations/integration-runner.service.ts's PROVIDERS map -
there is no IntegrationProvider for this (see Step 0).

STEP 2 — NO SCHEMA/SCHEDULER CHANGES
billingCycle MONTHLY is the existing default and already fully wired
(rollForwardRenewalDates, checkRenewalReminders, dashboard "/ mo" label,
Billing History). Confirm no changes are needed here - if you find yourself
editing scheduler.service.ts or the schema for this task, that's a sign
something Namecheap already built has regressed.

STEP 3 — CURRENCY CONVERSION
Tool.monthlyAmount is stored in USD always (see schema.prisma comment) - the
Add Tool form's manual amount field is labeled "Monthly amount ($)", it does
not accept INR directly. Convert ₹399 to USD using this app's own established
rate (USD_TO_INR=94.4, matching README/.env and what the dashboard's INR
toggle already uses) - do not invent a different rate or fetch a live one for
this one-off, since a manually-entered subscription cost is a point-in-time
conversion the user would have to do themselves either way.
  399 / 94.4 ≈ $4.23

STEP 4 — CREATE THE ACTUAL TOOL
Add the real Hostinger tool via the running app (API call or UI), matching
how other manual vendors are entered - not a backfill script (there's no
history to backfill, this is a brand-new tool going forward):
  name: "Hostinger", vendor: "Hostinger", category: HOSTING,
  paymentKind: MOSUB, billingCycle: MONTHLY, monthlyAmount: 4.23,
  renewalDate: 2026-09-12, triggerEmail: (existing org notification email)

CONSTRAINTS
- Do not build an IntegrationProvider for Hostinger given Step 0's conclusion.
- Do not add a new PaymentKind or touch billingCycle's MONTHLY path - this is
  a pure "add a vendor + create one tool" task, no generalization needed.
- Follow existing code style: no comments explaining what code does, only why.
```

---

## Definition of Done

1. **Known vendor entry**: "Hostinger" appears in the Add Tool integration dropdown, prefilling Vendor "Hostinger", Payment type Subscription, Billing cycle Monthly — via Manual setup only, no API key field shown (matches Namecheap/Google Workspace's existing entries exactly).
2. **No backend integration added**: `PROVIDERS` in `integration-runner.service.ts` is untouched — Hostinger never appears as a connectable API integration, consistent with Step 0's conclusion.
3. **No schema/scheduler changes**: confirmed the MONTHLY billing-cycle path (already built for Claude Pro, reused as-is by Namecheap's YEARLY generalization) needed zero edits for this task.
4. **Real tool created**: a Hostinger tool exists in the database with `monthlyAmount ≈ $4.23` (₹399 converted at 94.4), `billingCycle: MONTHLY`, `renewalDate: 2026-09-12` — verified via `psql`, not just reasoning about the code.
5. **Dashboard correctness**: the tool shows "$4.23 / mo" (not "/ yr"), and its renewal countdown/reminder behaves identically to Claude's existing monthly tool.
6. **Regression check**: `tsc --noEmit` clean on both apps; full test suite still passes (no test should reference the integration-providers list's exact length/contents in a way that breaks from one more entry — verified, not assumed).
7. **Step 0 documented**: this doc's Step 0 finding (Hostinger has a real Billing API, but it wasn't verified to expose a genuine per-subscription cost figure, and no live integration was built without that verification) is the recorded rationale, not a silent assumption.
