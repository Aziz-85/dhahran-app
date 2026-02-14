# Dhahran Team

Operational scheduling and task management for managers and employees.

## Tech stack

- **Next.js 14** (App Router)
- **TypeScript** (strict)
- **Prisma** + **PostgreSQL**
- **Tailwind CSS**
- Cookie-based auth (HTTP-only), username = EmpID, bcrypt
- i18n: Arabic / English with RTL/LTR

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

Example for local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dhahran_team?schema=public"
```

### 3. Database

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

**After pulling:** Run `npx prisma migrate deploy` to apply pending migrations (including the CoverageRules policy fix). Then `npm run db:seed` if needed for a fresh DB.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

- **Custom port:** `PORT=3001 npm run dev` (Unix) or `set PORT=3001 && npm run dev` (Windows).
- **LAN access:** The dev server binds to `0.0.0.0`; Next.js prints a Network URL (e.g. `http://192.168.x.x:3000`). Use `npm run dev:lan` for port 3001.

### Seed admin user

- **Username (Emp ID):** `admin`
- **Password:** `Admin@123`
- **Role:** ADMIN  
- You will be prompted to change password on first login.

## Scripts

| Script        | Description                |
|---------------|----------------------------|
| `npm run dev` | Start dev server           |
| `npm run dev:lan` | Dev server on port 3001, bind 0.0.0.0 for LAN access |
| `npm run build` | Production build         |
| `npm run start` | Start production server  |
| `npm run lint` | Run ESLint               |
| `npm run db:generate` | Prisma generate   |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed database        |
| `npm test` | Run tests (minimal)      |

## System overview

This app solves **operational scheduling and task/inventory management** for a team with a weekly roster (Saturday–Friday), day overrides, Rashid Boutique coverage, and role-based access. Managers see and edit the full schedule; employees see their own. Counts (boutique AM/PM, Rashid coverage) are computed from a single source of truth and must stay consistent between View and Editor.

## Schedule logic summary

- **Base shifts:** By team (A/B) and week parity: even week Team A AM / Team B PM, odd week swapped. **Friday has no morning shift** (boutique PM-only).
- **Overrides:** Stored per employee per day (MORNING, EVENING, NONE, COVER_RASHID_AM, COVER_RASHID_PM). Override wins over base.
- **Availability:** WORK | LEAVE | OFF | ABSENT (from leaves, weekly off day, inventory absent). Only **WORK** cells contribute to any count.
- **Counts:** Boutique AM = WORK + effectiveShift MORNING; Boutique PM = WORK + effectiveShift EVENING. Rashid AM/PM = WORK + COVER_RASHID_AM / COVER_RASHID_PM. Coverage shifts are **excluded** from boutique counts.
- **Single source of truth:** `lib/services/scheduleGrid.ts` — `getScheduleGridForWeek` builds rows/cells and counts; `computeDayCountsFromCells` / `computeCountsFromGridRows` define count rules. All views and the week grid API consume this. Do not duplicate counting logic elsewhere.

## Roles and permissions

- **EMPLOYEE:** Schedule view (read-only, own or full depending on route), own tasks, own inventory. **Cannot** open Schedule Editor or call override/grid save APIs (403).
- **MANAGER / ASSISTANT_MANAGER:** Full schedule view and edit, overrides, coverage, tasks, planner export, leaves, inventory. Cannot change system rules or users.
- **ADMIN:** Full access including users, employees, coverage rules, import.

RBAC is enforced server-side; see `docs/RBAC_MATRIX.md`. No write API is callable by EMPLOYEE.

## Main pages

- **Public:** `/login`, `/change-password`
- **Employee:** `/employee` (home: today schedule, today tasks, week roster)
- **Manager/Admin:** `/` (today operations), `/schedule`, `/schedule/editor`, `/tasks`, `/tasks/setup`, `/planner-export`
- **Admin:** `/admin/employees`, `/admin/users`, `/admin/coverage-rules`, `/admin/import`

## API (summary)

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `POST /api/auth/change-password`
- **Home:** `GET /api/home?date=`, `GET /api/employee/home?date=`
- **Schedule:** `GET /api/schedule/week?weekStart=`, `GET /api/schedule/month?month=`, `POST /api/overrides`, `PATCH /api/overrides/[id]`
- **Tasks:** `GET /api/tasks/day?date=`, `GET /api/tasks/range?from=&to=`, `GET/POST /api/tasks/setup`, etc.
- **Planner:** `POST /api/planner/export` (body: `{ from, to }`, returns CSV)
- **Admin:** `GET/POST /api/admin/users`, `GET/POST /api/admin/employees`, `GET/PATCH /api/admin/coverage-rules`, `POST /api/admin/import`

## Known constraints / assumptions

- Week starts **Saturday** (weekStart = Saturday YYYY-MM-DD).
- **Friday:** No MORNING or COVER_RASHID_AM; server rejects/skips them; UI hides AM options on Friday.
- **وضع رمضان (Ramadan):** الدوام كالمعتاد (صباحي + مساء)، مع إضافة دوام الفترة الصباحية ليوم الجمعة. أضف في `.env` (سنة 2026 فقط):
  - `RAMADAN_START=YYYY-MM-DD` (مثال: 2026-01-16)
  - `RAMADAN_END=YYYY-MM-DD` (مثال: 2026-03-21)
  يظهر شريط "وضع رمضان: الدوام كالمعتاد + صباحي الجمعة" عند عرض/تعديل أسبوع داخل الفترة، ويُسمح في رمضان باختيار دوام صباحي ليوم الجمعة.
- Month view uses `rosterForDate` (separate from week grid); week schedule is the single source for the grid.
- Validation: AM ≤ PM (except Friday), AM ≥ MinAM (except Friday), PM ≥ MinPM; warnings shown in Editor and View.

## How to safely modify schedule logic

1. **Counts or effectiveShift rules:** Change only in `lib/services/scheduleGrid.ts` (`computeDayCountsFromCells`, `computeCountsFromGridRows`, or the grid builder). Run `__tests__/schedule-counts.test.ts` after changes.
2. **Friday rule:** `lib/services/shift.ts` — `isAmShiftForbiddenOnDate`; keep overrides and grid/save aligned.
3. **New validation or errors:** Add keys to `lib/validationErrors.ts` and i18n; surface to user (toast or inline), no silent failures.
4. **New API or role:** Update `docs/RBAC_MATRIX.md` and use `requireRole` server-side.

## Tests

- **Schedule counts & Friday:** `__tests__/schedule-counts.test.ts` — count rules, Friday blocking, consistency (same input ⇒ same counts).
- **RBAC:** `__tests__/rbac-schedule.test.ts` — `canEditSchedule` and contract that EMPLOYEE cannot call write APIs.
- **API 403 contract:** `__tests__/api-403.test.ts` — documents expected 401/403 behavior.
- **Tasks:** `__tests__/tasks.test.ts` — task schedule logic.

Run: `npm test`
