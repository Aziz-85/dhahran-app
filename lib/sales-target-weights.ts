/**
 * Role-weighted target distribution (MSR template).
 * Manager: 0.5, Assistant Manager: 0.75, High Jewellery Expert: 2.0,
 * Senior Sales Advisor: 1.5, Sales Advisor: 1.0
 */

import type { EmployeePosition } from '@prisma/client';

/** Matches Prisma enum SalesTargetRole – defined here so build works even if client is not yet generated. */
export type SalesTargetRole =
  | 'MANAGER'
  | 'ASSISTANT_MANAGER'
  | 'HIGH_JEWELLERY_EXPERT'
  | 'SENIOR_SALES_ADVISOR'
  | 'SALES_ADVISOR';

export const SALES_TARGET_ROLE_WEIGHTS: Record<SalesTargetRole, number> = {
  MANAGER: 0.5,
  ASSISTANT_MANAGER: 0.75,
  HIGH_JEWELLERY_EXPERT: 2.0,
  SENIOR_SALES_ADVISOR: 1.5,
  SALES_ADVISOR: 1.0,
};

export const SALES_TARGET_ROLE_LABELS: Record<SalesTargetRole, string> = {
  MANAGER: 'Manager',
  ASSISTANT_MANAGER: 'Assistant Manager',
  HIGH_JEWELLERY_EXPERT: 'High Jewellery Expert',
  SENIOR_SALES_ADVISOR: 'Senior Sales Advisor',
  SALES_ADVISOR: 'Sales Advisor',
};

/** Derive SalesTargetRole from Employee.position when salesTargetRole is not set. */
export function positionToSalesTargetRole(position: EmployeePosition | null): SalesTargetRole {
  if (!position) return 'SALES_ADVISOR';
  switch (position) {
    case 'BOUTIQUE_MANAGER':
      return 'MANAGER';
    case 'ASSISTANT_MANAGER':
      return 'ASSISTANT_MANAGER';
    case 'SENIOR_SALES':
      return 'SENIOR_SALES_ADVISOR';
    case 'SALES':
    default:
      return 'SALES_ADVISOR';
  }
}

export function getWeightForRole(role: SalesTargetRole): number {
  return SALES_TARGET_ROLE_WEIGHTS[role];
}
