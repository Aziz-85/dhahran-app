import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { tasksRunnableOnDate, assignTaskOnDate } from '@/lib/services/tasks';

function iterateDates(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(from);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fromParam = request.nextUrl.searchParams.get('from');
  const toParam = request.nextUrl.searchParams.get('to');
  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'from and to required (YYYY-MM-DD)' }, { status: 400 });
  }

  const from = new Date(fromParam + 'T00:00:00Z');
  const to = new Date(toParam + 'T00:00:00Z');
  const isManagerOrAdmin = user.role === 'MANAGER' || user.role === 'ADMIN';

  const tasks = await prisma.task.findMany({
    where: { active: true },
    include: {
      taskSchedules: true,
      taskPlans: {
        include: {
          primary: { select: { empId: true, name: true } },
          backup1: { select: { empId: true, name: true } },
          backup2: { select: { empId: true, name: true } },
        },
      },
    },
  });

  const byDay: Record<string, Array<{
    taskId: string;
    taskName: string;
    assignedTo: string | null;
    reason: string;
    reasonNotes: string[];
  }>> = {};

  for (const date of iterateDates(from, to)) {
    const dateStr = date.toISOString().slice(0, 10);
    byDay[dateStr] = [];

    for (const task of tasks) {
      if (!tasksRunnableOnDate(task, date)) continue;
      const a = await assignTaskOnDate(task, date);
      if (isManagerOrAdmin || a.assignedEmpId === user.empId) {
        byDay[dateStr].push({
          taskId: task.id,
          taskName: task.name,
          assignedTo: a.assignedName ?? a.assignedEmpId,
          reason: a.reason,
          reasonNotes: a.reasonNotes,
        });
      }
    }
  }

  return NextResponse.json({ from: fromParam, to: toParam, byDay });
}
