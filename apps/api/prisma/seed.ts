import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface SeedTool {
  name: string; vendor: string; category: string; paymentKind: string;
  capAmount?: number; monthlyAmount?: number; usedAmount?: number; monoBgColor: string;
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  // Create demo org
  const org = await prisma.organization.upsert({
    where: { slug: 'northwind-eng-demo' },
    update: {},
    create: {
      name: 'Northwind Eng',
      slug: 'northwind-eng-demo',
      currency: 'INR',
      planTier: 'PRO',
    },
  });

  // Create root department
  const engDept = await prisma.department.upsert({
    where: { orgId_code: { orgId: org.id, code: 'ENG' } },
    update: {},
    create: { orgId: org.id, name: 'Engineering', code: 'ENG' },
  });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'admin@northwindeng.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'admin@northwindeng.com',
      name: 'Ravi Kapoor',
      initials: 'RK',
      passwordHash,
    },
  });

  await prisma.departmentMembership.upsert({
    where: { userId_departmentId: { userId: admin.id, departmentId: engDept.id } },
    update: {},
    create: { userId: admin.id, departmentId: engDept.id, role: 'ADMIN', isPrimary: true },
  });

  // Create seed tools
  const tools: SeedTool[] = [
    { name: 'Gemini API', vendor: 'Google', category: 'AI_LLM', paymentKind: 'PREPAID', capAmount: 1000, usedAmount: 450, monoBgColor: '#1A73E8' },
    { name: 'OpenAI API', vendor: 'OpenAI', category: 'AI_LLM', paymentKind: 'PREPAID', capAmount: 1000, usedAmount: 820, monoBgColor: '#10A37F' },
    { name: 'AWS', vendor: 'Amazon', category: 'CLOUD_INFRA', paymentKind: 'CAPSUB', capAmount: 50000, monthlyAmount: 38400, monoBgColor: '#FF9900' },
    { name: 'Slack', vendor: 'Salesforce', category: 'COMMUNICATION', paymentKind: 'MOSUB', monthlyAmount: 9600, monoBgColor: '#5b1f63' },
    { name: 'GitHub', vendor: 'Microsoft', category: 'DEV_TOOLS', paymentKind: 'NOBUDGET', monoBgColor: '#30363D' },
    { name: 'Figma', vendor: 'Figma Inc.', category: 'DESIGN', paymentKind: 'MOSUB', monthlyAmount: 7200, monoBgColor: '#F24E1E' },
    { name: 'Vercel', vendor: 'Vercel', category: 'HOSTING', paymentKind: 'MOSUB', monthlyAmount: 16000, monoBgColor: '#000000' },
    { name: 'Datadog', vendor: 'Datadog', category: 'MONITORING', paymentKind: 'MOSUB', monthlyAmount: 5400, monoBgColor: '#632CA6' },
  ];

  for (const t of tools) {
    const barPct = t.capAmount
      ? Math.round(((t.usedAmount || t.monthlyAmount || 0) / t.capAmount) * 100)
      : t.monthlyAmount
      ? 60
      : 0;

    const initials = t.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

    await prisma.tool.upsert({
      where: { orgId_name: { orgId: org.id, name: t.name } },
      update: {},
      create: {
        orgId: org.id,
        departmentId: engDept.id,
        name: t.name,
        vendor: t.vendor,
        category: t.category as any,
        paymentKind: t.paymentKind as any,
        capAmount: t.capAmount || 0,
        monthlyAmount: t.monthlyAmount || 0,
        usedAmount: t.usedAmount || 0,
        barPct,
        alertThresholdPct: 80,
        monoBgColor: t.monoBgColor,
        monoInitials: initials,
      },
    });
  }

  // Seed billing records for last 3 months
  const months = ['2026-04', '2026-05', '2026-06'];
  const monthLabels = ['Apr 2026', 'May 2026', 'Jun 2026'];

  const allTools = await prisma.tool.findMany({ where: { orgId: org.id } });
  for (let mi = 0; mi < months.length; mi++) {
    for (const tool of allTools) {
      if (tool.paymentKind === 'NOBUDGET') continue;
      const amount = tool.monthlyAmount || tool.usedAmount || 0;
      if (amount === 0) continue;

      await prisma.billingRecord.upsert({
        where: { orgId_toolId_monthKey: { orgId: org.id, toolId: tool.id, monthKey: months[mi] } },
        update: {},
        create: {
          orgId: org.id,
          toolId: tool.id,
          toolSnapshotJson: { name: tool.name, category: tool.category },
          monthKey: months[mi],
          monthLabel: monthLabels[mi],
          amount,
          status: mi < 2 ? 'PAID' : 'PENDING',
          paidAt: mi < 2 ? new Date() : null,
        },
      });
    }
  }

  console.log('Seed complete. Admin login: admin@northwindeng.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
