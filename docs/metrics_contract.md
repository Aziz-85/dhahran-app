# Metrics Contract — Single Source of Truth

**Version:** 1.0  
**Timezone:** Asia/Riyadh for all date boundaries.  
**Date range:** Inclusive `from` at 00:00:00.000, exclusive `to` (next day 00:00:00.000 or first day of next month).

---

## Unification summary (what was fixed)

**Inconsistency:** Dashboard showed zeros or different MTD than /me/target and /sales/my because:
- Dashboard used **session boutique** (`getScheduleScope` → `user.boutiqueId` or ?b= for SUPER_ADMIN).
- /me/targets and /me/sales used **Employee.boutiqueId** via `getEmployeeBoutiqueIdForUser`.
- For EMPLOYEE/ASSISTANT_MANAGER, session boutique can differ from assigned employee boutique (e.g. after transfer), so dashboard and “my” pages showed different scopes and numbers.

**Unified:**
- **Scope:** All metrics now use `resolveMetricsScope(request)`:
  - EMPLOYEE / ASSISTANT_MANAGER: `effectiveBoutiqueId = Employee.boutiqueId` (single source: User.empId → Employee.boutiqueId).
  - MANAGER / ADMIN / SUPER_ADMIN: `effectiveBoutiqueId` from `getOperationalScope(request)` (session or ?b=).
- **Sales actuals:** Single aggregator `getDashboardSalesMetrics` and `getTargetMetrics` in `lib/metrics/aggregator.ts` (SalesEntry only; sources LEDGER, IMPORT, MANUAL). Same date logic: `getMonthRange`, `toRiyadhDateString`, etc. from `lib/time`.
- **Dashboard** uses `resolveMetricsScope` + `getDashboardSalesMetrics`; **me/targets** uses `resolveMetricsScope` + `getTargetMetrics`; **me/sales** and **sales/summary** scope aligned via `resolveMetricsScope` (and getSalesScope using Employee.boutiqueId for EMPLOYEE/ASSISTANT_MANAGER).
- **Dashboard UI** no longer overwrites sales with monthly-matrix; dashboard API is the single source for dashboard KPIs.

**Result:** For the same user + boutique + month, dashboard monthly actual, /me/target MTD, and calendar month total now use the same scope and same SalesEntry data.

---

## 1. KPI fields by route

### 1.1 Dashboard (`/dashboard`)

| Field | Description | Source |
|-------|-------------|--------|
| `currentMonthTarget` | Boutique (or employee for EMPLOYEE) monthly target SAR | BoutiqueMonthlyTarget / EmployeeMonthlyTarget |
| `currentMonthActual` | MTD sales SAR | SalesEntry sum for month |
| `completionPct` | (actual / target) * 100 | Derived |
| `remainingGap` | max(0, target - actual) | Derived |
| Schedule health | week approved, AM/PM counts, coverage violations | ScheduleLock, roster, coverageValidation |
| Task control | weekly total, completed, pending, overdue, zone summary | Task, TaskCompletion |
| Sales breakdown | per-employee target, actual, pct | EmployeeMonthlyTarget + SalesEntry groupBy userId |
| Team table | empId, name, role, target, actual, pct, tasksDone, zone | Same as above + task completions + zone assignments |

### 1.2 Sales My (`/sales/my`)

| Field | Description | Source |
|-------|-------------|--------|
| `netSalesTotal` | Sum of SalesEntry.amount in range | SalesEntry |
| `grossSalesTotal` | Same as net (no returns/exchanges in SalesEntry) | SalesEntry |
| `returnsTotal` | Sum of returns in range | SalesTransaction type=RETURN (optional) |
| `exchangesTotal` | Sum of exchanges | SalesTransaction type=EXCHANGE (optional) |
| `guestCoverageNetSales` | Sales credited from guest coverage | SalesTransaction isGuestCoverage (optional) |
| `breakdownByEmployee` | Per-employee net sales | SalesEntry groupBy userId |

### 1.3 Sales Returns (`/sales/returns`)

| Field | Description | Source |
|-------|-------------|--------|
| `items` | List of RETURN/EXCHANGE txns in range | SalesTransaction |
| `from` / `to` | Range dates | Query params |
| `canAdd` | Can user add manual return/exchange | RBAC |

### 1.4 My Target (`/me/target`)

| Field | Description | Source |
|-------|-------------|--------|
| `monthKey` | YYYY-MM | Query |
| `monthTarget` | Employee monthly target SAR | EmployeeMonthlyTarget |
| `mtdSales` | Sum SalesEntry for month, user | SalesEntry |
| `todaySales` | SalesEntry for today | SalesEntry |
| `weekSales` | SalesEntry for current week (Sat–Fri) in month | SalesEntry |
| `dailyTarget` / `weekTarget` | Proportional to month target | getDailyTargetForDay |
| `remaining` | max(0, monthTarget - mtdSales) | Derived |
| `pctDaily` / `pctWeek` / `pctMonth` | Percentages | Derived |
| Calendar entries | Per-day amounts for month | SalesEntry by dateKey |

---

## 2. Data tables (canonical)

| Table | Use |
|-------|-----|
| **SalesEntry** | Single source for “sales actuals” (LEDGER, IMPORT, MANUAL). Fields: boutiqueId, date, dateKey, month, userId, amount, source. |
| **EmployeeMonthlyTarget** | Per-user, per-boutique, per-month target SAR. |
| **BoutiqueMonthlyTarget** | Per-boutique, per-month target SAR. |
| **SalesTransaction** | RETURN/EXCHANGE rows (halalas); for returns page and optional net = sales - returns - exchanges. |

**Net sales definition:** For dashboard and MTD we use **SalesEntry.amount sum** only (no subtraction of returns/exchanges in current schema). If business rule changes, define once here: e.g. `netSales = salesEntrySum - returnsSum - exchangesSum`.

**Guest coverage:** SalesTransaction.isGuestCoverage; aggregate netAmount where isGuestCoverage = true for “guest coverage net sales”.

---

## 3. Scope rules (RBAC)

| Role | effectiveBoutiqueId | effectiveEmployeeId / userId |
|------|---------------------|------------------------------|
| EMPLOYEE | Employee.boutiqueId (via User.empId) | Self only |
| ASSISTANT_MANAGER | Employee.boutiqueId | Self only for “my” metrics; team for dashboard |
| MANAGER | Operational boutique (preference or first membership) | Team in boutique |
| ADMIN | Operational boutique or requested | Any in boutique |
| SUPER_ADMIN | ?b= or session boutique | Any, cross-boutique if requested |

EMPLOYEE cannot request other employee or other boutique. All aggregation must filter by resolved scope server-side.

---

## 4. Date boundaries (Asia/Riyadh)

- **Today:** `toRiyadhDateString(getRiyadhNow())` → YYYY-MM-DD.
- **Month range:** `getMonthRange(monthKey)` → start (inclusive), endExclusive (first day of next month).
- **MTD:** SalesEntry where `month = monthKey` and `dateKey` in month (already stored).
- **Arbitrary range:** fromDate 00:00:00.000, toDateExclusive = next day 00:00:00.000; query `date >= fromDate AND date < toDateExclusive`.

---

## 5. API endpoints (unified)

- `GET /api/metrics/dashboard` — Uses resolveMetricsScope + getDashboardMetrics. Returns snapshot, salesBreakdown, teamTable, etc.
- `GET /api/metrics/sales-my?from=&to=` — Uses resolveMetricsScope + getSalesMetrics. Same scope as dashboard.
- `GET /api/metrics/returns?from=&to=` — Uses resolveMetricsScope + returns list. Same scope.
- `GET /api/metrics/my-target?month=YYYY-MM` — Uses resolveMetricsScope + getTargetMetrics. Same scope (Employee.boutiqueId for EMPLOYEE).

All accept optional `boutiqueId` (or `b=`) for ADMIN/SUPER_ADMIN to align with “Working on” selector where implemented.
