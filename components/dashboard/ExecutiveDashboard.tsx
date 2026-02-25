'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/providers';
import { getRoleDisplayLabel } from '@/lib/roleLabel';
import type { Role } from '@prisma/client';
import type { EmployeePosition } from '@prisma/client';
import { SalesPerformanceCard } from './cards/SalesPerformanceCard';
import { ScheduleHealthCard } from './cards/ScheduleHealthCard';
import { TaskControlCard } from './cards/TaskControlCard';
import { ControlAlertsCard } from './cards/ControlAlertsCard';
import { SalesBreakdownSection } from './sections/SalesBreakdownSection';
import { ScheduleOverviewSection } from './sections/ScheduleOverviewSection';
import { TaskIntegritySection } from './sections/TaskIntegritySection';
import { TeamTableSection } from './sections/TeamTableSection';

type DashboardData = {
  rbac: {
    role: string;
    showAntiGaming: boolean;
    showPlannerSync: boolean;
    showFullDashboard: boolean;
  };
  snapshot?: {
    sales?: {
      currentMonthTarget: number;
      currentMonthActual: number;
      completionPct: number;
      remainingGap: number;
    };
    scheduleHealth?: {
      weekApproved: boolean;
      todayAmCount: number;
      todayPmCount: number;
      coverageViolationsCount: number;
    };
    taskControl?: {
      totalWeekly: number;
      completed: number;
      pending: number;
      overdue: number;
      zoneStatusSummary: string;
    };
    controlAlerts?: {
      suspiciousCount: number;
      leaveConflictsCount: number;
      unapprovedWeekWarning: boolean;
      lastPlannerSync: string | null;
    };
  };
  salesBreakdown?: { empId?: string; name: string; target: number; actual: number; pct: number }[];
  scheduleOverview?: {
    amPmBalanceSummary: string;
    daysOverloaded: string[];
    imbalanceHighlight: boolean;
  };
  taskIntegrity?: {
    burstFlagsCount: number;
    sameDayBulkCount: number;
    top3SuspiciousUsers: string[];
  };
  teamTable?: {
    rows: {
      empId?: string;
      employee: string;
      role: string;
      position?: EmployeePosition | null;
      target: number;
      actual: number;
      pct: number;
      tasksDone: number;
      late: number;
      zone: string | null;
    }[];
  };
};

type MonthlyMatrixData = {
  grandTotalSar?: number;
  totalsByEmployee?: { employeeId: string; totalSar: number }[];
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

export function ExecutiveDashboard() {
  const { messages } = useI18n();
  const t = useCallback((key: string) => (getNested(messages, key) as string) || key, [messages]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teamRowsWithRoleLabel = useMemo(() => {
    const rows = data?.teamTable?.rows ?? [];
    return rows.map((r) => ({
      ...r,
      roleLabel: getRoleDisplayLabel(r.role as Role, r.position ?? null, t),
    }));
  }, [data?.teamTable?.rows, t]);

  useEffect(() => {
    const monthKey = currentMonthKey();
    Promise.all([
      fetch('/api/dashboard').then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      }),
      fetch(`/api/sales/monthly-matrix?month=${encodeURIComponent(monthKey)}`, { cache: 'no-store' }).then(
        (res) => (res.ok ? res.json() : (null as MonthlyMatrixData | null))
      ),
    ])
      .then(([dashboardData, matrixData]: [DashboardData, MonthlyMatrixData | null]) => {
        if (matrixData?.totalsByEmployee != null && matrixData?.grandTotalSar != null) {
          const byEmpId = new Map((matrixData.totalsByEmployee ?? []).map((t) => [t.employeeId, t.totalSar]));
          const target = dashboardData.snapshot?.sales?.currentMonthTarget ?? 0;
          const actual = matrixData.grandTotalSar;
          const completionPct = target > 0 ? Math.round((actual / target) * 100) : 0;
          const remainingGap = Math.max(0, target - actual);
          if (dashboardData.snapshot?.sales) {
            dashboardData.snapshot.sales.currentMonthActual = actual;
            dashboardData.snapshot.sales.completionPct = completionPct;
            dashboardData.snapshot.sales.remainingGap = remainingGap;
          }
          if (dashboardData.salesBreakdown?.length) {
            dashboardData.salesBreakdown = dashboardData.salesBreakdown.map((row) => {
              const empId = row.empId ?? row.name;
              const actualSar = byEmpId.get(empId) ?? 0;
              const pct = row.target > 0 ? Math.round((actualSar / row.target) * 100) : 0;
              return { ...row, actual: actualSar, pct };
            });
          }
          if (dashboardData.teamTable?.rows?.length) {
            dashboardData.teamTable.rows = dashboardData.teamTable.rows.map((row) => {
              const empId = row.empId ?? row.employee;
              const actualSar = byEmpId.get(empId) ?? 0;
              const pct = row.target > 0 ? Math.round((actualSar / row.target) * 100) : 0;
              return { ...row, actual: actualSar, pct };
            });
          }
        }
        setData(dashboardData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-red-600">{error ?? 'Failed to load dashboard'}</p>
      </div>
    );
  }

  const { rbac, snapshot, salesBreakdown, scheduleOverview, taskIntegrity, teamTable } = data;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Executive Dashboard</h1>

      {/* Section 1 — Top 4 cards */}
      <section className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot?.sales && (
          <SalesPerformanceCard
            currentMonthTarget={snapshot.sales.currentMonthTarget}
            currentMonthActual={snapshot.sales.currentMonthActual}
            completionPct={snapshot.sales.completionPct}
            remainingGap={snapshot.sales.remainingGap}
          />
        )}
        {snapshot?.scheduleHealth && (
          <ScheduleHealthCard
            weekApproved={snapshot.scheduleHealth.weekApproved}
            todayAmCount={snapshot.scheduleHealth.todayAmCount}
            todayPmCount={snapshot.scheduleHealth.todayPmCount}
            coverageViolationsCount={snapshot.scheduleHealth.coverageViolationsCount}
          />
        )}
        {snapshot?.taskControl && (
          <TaskControlCard
            totalWeekly={snapshot.taskControl.totalWeekly}
            completed={snapshot.taskControl.completed}
            pending={snapshot.taskControl.pending}
            overdue={snapshot.taskControl.overdue}
            zoneStatusSummary={snapshot.taskControl.zoneStatusSummary}
          />
        )}
        {snapshot?.controlAlerts && (
          <ControlAlertsCard
            suspiciousCount={snapshot.controlAlerts.suspiciousCount}
            leaveConflictsCount={snapshot.controlAlerts.leaveConflictsCount}
            unapprovedWeekWarning={snapshot.controlAlerts.unapprovedWeekWarning}
            lastPlannerSync={snapshot.controlAlerts.lastPlannerSync}
            showPlannerSync={rbac.showPlannerSync}
          />
        )}
      </section>

      {/* Section 2 — Sales breakdown */}
      {salesBreakdown && salesBreakdown.length > 0 && (
        <section className="mb-6">
          <SalesBreakdownSection employees={salesBreakdown} />
        </section>
      )}

      {/* Section 3 — Schedule overview (all except employee) */}
      {scheduleOverview && (
        <section className="mb-6">
          <ScheduleOverviewSection
            amPmBalanceSummary={scheduleOverview.amPmBalanceSummary}
            daysOverloaded={scheduleOverview.daysOverloaded ?? []}
            imbalanceHighlight={scheduleOverview.imbalanceHighlight}
          />
        </section>
      )}

      {/* Section 4 — Task integrity (hide for ASSISTANT_MANAGER) */}
      {rbac.showAntiGaming && taskIntegrity && (
        <section className="mb-6">
          <TaskIntegritySection
            burstFlagsCount={taskIntegrity.burstFlagsCount}
            sameDayBulkCount={taskIntegrity.sameDayBulkCount}
            top3SuspiciousUsers={taskIntegrity.top3SuspiciousUsers ?? []}
          />
        </section>
      )}

      {/* Section 5 — Team table */}
      {teamTable && teamTable.rows.length > 0 && (
        <section className="mb-6">
          <TeamTableSection rows={teamRowsWithRoleLabel} />
        </section>
      )}
    </div>
  );
}
