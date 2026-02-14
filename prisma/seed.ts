import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin@123', 10);

  await prisma.employee.upsert({
    where: { empId: 'admin' },
    update: { isSystemOnly: true },
    create: {
      empId: 'admin',
      name: 'Admin User',
      email: 'admin@example.com',
      team: 'A',
      weeklyOffDay: 5, // Friday
      active: true,
      isSystemOnly: true, // excluded from roster and all employee lists; controls system only
      language: 'en',
    },
  });

  await prisma.user.upsert({
    where: { empId: 'admin' },
    update: {},
    create: {
      empId: 'admin',
      role: 'ADMIN',
      passwordHash: adminHash,
      mustChangePassword: true,
      disabled: false,
    },
  });

  const rules = await prisma.coverageRule.count();
  if (rules === 0) {
    await prisma.coverageRule.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        minAM: dayOfWeek === 5 ? 0 : 2, // Friday PM-only; others min 2
        minPM: 2, // informational only (agreed display value; enforcement is AM≥PM and AM≥2)
        enabled: true,
      })),
    });
  }

  console.log('Seed completed. Admin user: empId=admin, password=Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
