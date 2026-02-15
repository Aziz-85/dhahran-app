/**
 * Shared filters for Employee queries so disabled users (User.disabled = true)
 * are excluded from schedule, tasks, zone assignment, leaves list, etc.
 */

/** Use in Employee findMany: only employees with no linked user OR user not disabled. */
export const notDisabledUserWhere = {
  OR: [
    { user: { is: null } },
    { user: { disabled: false } },
  ],
};
