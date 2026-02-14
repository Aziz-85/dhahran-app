import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { tasksRunnableOnDate, assignTaskOnDate } from '@/lib/services/tasks';

type ToggleAction = 'done' | 'undo';

function getTodayDateInKsa(): { dateStr: string; date: Date } {
  const now = new Date();
  const ksaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }));
  const year = ksaNow.getFullYear();
  const month = String(ksaNow.getMonth() + 1).padStart(2, '0');
  const day = String(ksaNow.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const date = new Date(`${dateStr}T00:00:00Z`);
  return { dateStr, date };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { taskId?: string; action?: ToggleAction } | null;
  const taskId = body?.taskId;
  const action = body?.action;

  if (!taskId || (action !== 'done' && action !== 'undo')) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { date } = getTodayDateInKsa();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
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

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (!tasksRunnableOnDate(task, date)) {
    return NextResponse.json({ error: 'Task not due today' }, { status: 400 });
  }

  const assignment = await assignTaskOnDate(task, date);

  if (assignment.assignedEmpId !== user.empId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();

  if (action === 'done') {
    const completion = await prisma.taskCompletion.upsert({
      where: {
        taskId_userId: {
          taskId,
          userId: user.id,
        },
      },
      create: {
        taskId,
        userId: user.id,
        completedAt: now,
        undoneAt: null,
      },
      update: {
        completedAt: now,
        undoneAt: null,
      },
    });

    return NextResponse.json({
      taskId,
      isCompleted: true,
      completedAt: completion.completedAt.toISOString(),
    });
  }

  // action === 'undo'
  try {
    const completion = await prisma.taskCompletion.update({
      where: {
        taskId_userId: {
          taskId,
          userId: user.id,
        },
      },
      data: {
        undoneAt: now,
      },
    });

    return NextResponse.json({
      taskId,
      isCompleted: false,
      completedAt: completion.completedAt.toISOString(),
    });
  } catch {
    // If there is no existing completion row, treat as no-op.
    return NextResponse.json({
      taskId,
      isCompleted: false,
      completedAt: null,
    });
  }
}

