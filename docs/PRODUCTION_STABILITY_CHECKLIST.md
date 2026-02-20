# Production Stability Checklist

Use this checklist before and after deployments to verify critical flows.

---

## Cross-boutique guest coverage (schedule)

**Feature:** A host boutique (e.g. Al Rashid) can show coverage shifts performed by employees whose home boutique is different (e.g. Dhahran Mall), on specific dates only. `Employee.boutiqueId` is never changed; guest coverage is per-date assignment to the host boutique.

### Test case: Guest on one day, counts in totals

1. **Setup**
   - Ensure two boutiques exist (e.g. Dhahran, Al Rashid) with distinct employees.
   - Log in as ADMIN or MANAGER with operational scope set to **Al Rashid** (host).

2. **Add guest**
   - Open **Schedule (View)** and select a week. Switch to **Grid** view if needed.
   - Click **Add External Coverage** (or "إضافة تغطية خارجية").
   - Choose an employee whose home boutique is **Dhahran** (not Al Rashid).
   - Select **Tuesday**, shift **AM**, and a reason (e.g. "Coverage / visit").
   - Submit.

3. **Verify (Option 1: External Coverage section)**
   - The **base roster** shows only Al Rashid employees (no guest rows in the main table).
   - At the bottom of the grid, the **External Coverage** row appears.
   - The Dhahran employee appears **only in the Tuesday column** under External Coverage (name + "Guest (HOME_CODE)" + AM).
   - Other day columns have no entry for this guest.
   - **Tuesday AM** total for Al Rashid includes this guest (count +1).
   - Switching to **Dhahran** schedule does **not** show this assignment (host is Al Rashid).
   - Employee list in Admin → Employees is unchanged; the employee’s home boutique is still Dhahran.

4. **APIs (optional)**
   - `GET /api/schedule/guests?weekStart=YYYY-MM-DD` returns the guest shift(s) for the host boutique in that week.
   - `DELETE /api/schedule/guests?id=<overrideId>` removes the guest shift; the row disappears from the host week after refresh.

---

## Other checks

- [ ] Login and session (including `User.boutiqueId`) work after migrations.
- [ ] Schedule view and edit load without 500s; grid and counts match expectations.
- [ ] `npx prisma migrate deploy` and `npx prisma generate` run on the server after pull.
