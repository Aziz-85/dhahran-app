import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { rosterForDate } from '@/lib/services/roster';
import { prisma } from '@/lib/db';
import { tasksRunnableOnDate, assignTaskOnDate } from '@/lib/services/tasks';
import { validateCoverage } from '@/lib/services/coverageValidation';
import { getCoverageSuggestion } from '@/lib/services/coverageSuggestion';
import type { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const dateParam = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateParam + 'T00:00:00Z');

    const [roster, coverageValidation, suggestionResult] = await Promise.all([
      rosterForDate(date),
      validateCoverage(date),
      getCoverageSuggestion(date),
    ]);
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

    const todayTasks: Array<{
      taskId: string;
      taskName: string;
      assignedTo: string | null;
      reason: string;
      reasonNotes: string[];
    }> = [];

    for (const task of tasks) {
      if (!tasksRunnableOnDate(task, date)) continue;
      const a = await assignTaskOnDate(task, date);
      todayTasks.push({
        taskId: task.id,
        taskName: task.name,
        assignedTo: a.assignedName ?? a.assignedEmpId,
        reason: a.reason,
        reasonNotes: a.reasonNotes,
      });
    }

    return NextResponse.json({
      date: date.toISOString().slice(0, 10),
      roster,
      coverageValidation,
      coverageSuggestion: suggestionResult.suggestion,
      coverageSuggestionExplanation: suggestionResult.explanation,
      todayTasks,
    });
  } catch (err) {
    console.error('/api/home error:', err);
    return NextResponse.json(
      { error: 'Server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
