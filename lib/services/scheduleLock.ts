/**
 * Schedule locking (Sprint 1: DAY / WEEK + RBAC).
 * Unified ScheduleLock: scopeType DAY | WEEK, scopeValue = YYYY-MM-DD.
 * Week start = Saturday YYYY-MM-DD.
 */

import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';
import { getWeekStartSaturday } from '@/lib/utils/week';

export type ScheduleWeekStatusEnum = 'DRAFT' | 'APPROVED';

export function getWeekStart(date: Date): string {
  const start = getWeekStartSaturday(date);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getWeekStatus(weekStart: string): Promise<{
  status: ScheduleWeekStatusEnum;
  approvedByUserId: string | null;
  approvedAt: Date | null;
} | null> {
  const row = await prisma.scheduleWeekStatus.findUnique({
    where: { weekStart },
  });
  if (!row) return { status: 'DRAFT', approvedByUserId: null, approvedAt: null };
  return {
    status: row.status as ScheduleWeekStatusEnum,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
  };
}

export type LockInfo = {
  id: string;
  scopeType: 'DAY' | 'WEEK';
  scopeValue: string;
  lockedByUserId: string;
  lockedAt: Date;
  reason: string | null;
  isActive: boolean;
};

export async function isWeekLocked(weekStart: string): Promise<boolean> {
  const lock = await prisma.scheduleLock.findFirst({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
  });
  return !!lock;
}

export async function isDayLocked(date: Date): Promise<boolean> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dateStr = d.toISOString().slice(0, 10);
  const lock = await prisma.scheduleLock.findFirst({
    where: { scopeType: 'DAY', scopeValue: dateStr, isActive: true },
  });
  return !!lock;
}

export async function getWeekLockInfo(weekStart: string): Promise<LockInfo | null> {
  const lock = await prisma.scheduleLock.findFirst({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
  });
  return lock
    ? {
        id: lock.id,
        scopeType: lock.scopeType as 'WEEK',
        scopeValue: lock.scopeValue,
        lockedByUserId: lock.lockedByUserId,
        lockedAt: lock.lockedAt,
        reason: lock.reason,
        isActive: lock.isActive,
      }
    : null;
}

export async function getDayLockInfo(date: Date): Promise<LockInfo | null> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dateStr = d.toISOString().slice(0, 10);
  const lock = await prisma.scheduleLock.findFirst({
    where: { scopeType: 'DAY', scopeValue: dateStr, isActive: true },
  });
  return lock
    ? {
        id: lock.id,
        scopeType: lock.scopeType as 'DAY',
        scopeValue: lock.scopeValue,
        lockedByUserId: lock.lockedByUserId,
        lockedAt: lock.lockedAt,
        reason: lock.reason,
        isActive: lock.isActive,
      }
    : null;
}

/** Returns lock info for week (if week locked) and which days in the week are day-locked. */
export async function getWeekLockInfoDetailed(weekStart: string): Promise<{
  weekLock: LockInfo | null;
  lockedDays: string[]; // date strings YYYY-MM-DD
}> {
  const weekLock = await prisma.scheduleLock.findFirst({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
  });
  const start = new Date(weekStart + 'T00:00:00Z');
  const lockedDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLock = await prisma.scheduleLock.findFirst({
      where: { scopeType: 'DAY', scopeValue: dateStr, isActive: true },
    });
    if (dayLock) lockedDays.push(dateStr);
  }
  return {
    weekLock: weekLock
      ? {
          id: weekLock.id,
          scopeType: weekLock.scopeType as 'WEEK',
          scopeValue: weekLock.scopeValue,
          lockedByUserId: weekLock.lockedByUserId,
          lockedAt: weekLock.lockedAt,
          reason: weekLock.reason,
          isActive: weekLock.isActive,
        }
      : null,
    lockedDays,
  };
}

/** ASSISTANT_MANAGER + MANAGER: day only. ADMIN: day + week. (Sprint 1: Lock Week = Admin only) */
export function canLockDay(role: Role): boolean {
  return role === 'ASSISTANT_MANAGER' || role === 'MANAGER' || role === 'ADMIN';
}

export function canLockWeek(role: Role): boolean {
  return role === 'ADMIN';
}

export function canUnlockWeek(role: Role): boolean {
  return role === 'ADMIN';
}

export function canApproveWeek(role: Role): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

export function canUnlockDay(role: Role): boolean {
  return role === 'ASSISTANT_MANAGER' || role === 'MANAGER' || role === 'ADMIN';
}

/** Ensure week status exists; set to APPROVED. */
export async function approveWeek(weekStart: string, userId: string): Promise<void> {
  await prisma.scheduleWeekStatus.upsert({
    where: { weekStart },
    create: { weekStart, status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
    update: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
  });
}

/** Revert week to DRAFT; clear approval metadata. ADMIN only. Allowed when week is not locked. */
export async function unapproveWeek(weekStart: string): Promise<void> {
  const locked = await isWeekLocked(weekStart);
  if (locked) {
    throw new Error('WEEK_LOCKED');
  }
  await prisma.scheduleWeekStatus.upsert({
    where: { weekStart },
    create: { weekStart, status: 'DRAFT' },
    update: { status: 'DRAFT', approvedByUserId: null, approvedAt: null },
  });
}

/** Lock day. ASSISTANT_MANAGER+ can lock day. */
export async function lockDay(date: Date, userId: string, reason?: string | null): Promise<void> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dateStr = d.toISOString().slice(0, 10);
  // Deactivate any existing active lock
  await prisma.scheduleLock.updateMany({
    where: { scopeType: 'DAY', scopeValue: dateStr, isActive: true },
    data: { isActive: false },
  });
  // Create new active lock
  await prisma.scheduleLock.create({
    data: {
      scopeType: 'DAY',
      scopeValue: dateStr,
      lockedByUserId: userId,
      reason: reason ?? null,
      isActive: true,
    },
  });
}

/** Unlock day (revoke active lock). */
export async function unlockDay(date: Date, revokedByUserId: string): Promise<void> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dateStr = d.toISOString().slice(0, 10);
  await prisma.scheduleLock.updateMany({
    where: { scopeType: 'DAY', scopeValue: dateStr, isActive: true },
    data: { isActive: false, revokedByUserId, revokedAt: new Date() },
  });
}

/** Lock week. ADMIN only. Week must be APPROVED (Sprint 2). */
export async function lockWeek(weekStart: string, userId: string, reason?: string | null): Promise<void> {
  const status = await getWeekStatus(weekStart);
  if (status?.status !== 'APPROVED') {
    throw new Error('WEEK_NOT_APPROVED');
  }
  // Deactivate any existing active lock
  await prisma.scheduleLock.updateMany({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
    data: { isActive: false },
  });
  // Create new active lock
  await prisma.scheduleLock.create({
    data: {
      scopeType: 'WEEK',
      scopeValue: weekStart,
      lockedByUserId: userId,
      reason: reason ?? null,
      isActive: true,
    },
  });
}

/** Lock week without requiring APPROVED (Phase F Sprint 1: no approval logic). ADMIN only. */
export async function lockWeekAllowDraft(weekStart: string, userId: string, reason?: string | null): Promise<void> {
  // Deactivate any existing active lock
  await prisma.scheduleLock.updateMany({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
    data: { isActive: false },
  });
  // Create new active lock
  await prisma.scheduleLock.create({
    data: {
      scopeType: 'WEEK',
      scopeValue: weekStart,
      lockedByUserId: userId,
      reason: reason ?? null,
      isActive: true,
    },
  });
}

/** Unlock week (revoke active lock). ADMIN only. */
export async function unlockWeek(weekStart: string, revokedByUserId: string): Promise<void> {
  await prisma.scheduleLock.updateMany({
    where: { scopeType: 'WEEK', scopeValue: weekStart, isActive: true },
    data: { isActive: false, revokedByUserId, revokedAt: new Date() },
  });
  // Optionally revert week status to DRAFT (if needed)
  // await prisma.scheduleWeekStatus.upsert({
  //   where: { weekStart },
  //   create: { weekStart, status: 'DRAFT' },
  //   update: { status: 'DRAFT', approvedByUserId: null, approvedAt: null },
  // });
}

/** Check if any of the given dates are in a locked week or are locked days. Returns error message or null. */
export async function checkLockForChanges(dates: string[]): Promise<{ forbidden: true; message: string } | null> {
  const weekStarts = new Set<string>();
  for (const dateStr of dates) {
    weekStarts.add(getWeekStart(new Date(dateStr + 'T00:00:00Z')));
  }
  for (const ws of Array.from(weekStarts)) {
    if (await isWeekLocked(ws)) {
      return { forbidden: true, message: 'Schedule week is locked' };
    }
  }
  for (const dateStr of dates) {
    if (await isDayLocked(new Date(dateStr + 'T00:00:00Z'))) {
      return { forbidden: true, message: 'Schedule day is locked' };
    }
  }
  return null;
}
