import { prisma } from '@/lib/db';

export type AvailabilityStatus = 'LEAVE' | 'OFF' | 'WORK' | 'ABSENT';

/** Precedence: LEAVE > OFF > ABSENT > WORK. */
export async function availabilityFor(empId: string, date: Date): Promise<AvailabilityStatus> {
  const d = toDateOnly(date);

  const leave = await prisma.leave.findFirst({
    where: {
      empId,
      status: 'APPROVED',
      startDate: { lte: d },
      endDate: { gte: d },
    },
  });
  if (leave) return 'LEAVE';

  const emp = await prisma.employee.findUnique({
    where: { empId },
    select: { weeklyOffDay: true },
  });
  if (emp) {
    const dayOfWeek = getDayOfWeek(d);
    if (dayOfWeek === emp.weeklyOffDay) return 'OFF';
  }

  const absent = await prisma.inventoryAbsent.findUnique({
    where: { date_empId: { date: d, empId } },
  });
  if (absent) return 'ABSENT';

  return 'WORK';
}

function toDateOnly(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getDayOfWeek(date: Date): number {
  return date.getUTCDay();
}
