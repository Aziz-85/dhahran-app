import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// In production, ensure DATABASE_URL points to the real DB (not localhost/dev credentials).
if (process.env.NODE_ENV === 'production') {
  const u = process.env.DATABASE_URL ?? '';
  if (!u || u.includes('localhost') || u.includes('127.0.0.1')) {
    console.error(
      '[db] PRODUCTION ERROR: DATABASE_URL is missing or points to localhost. ' +
        'Set .env on the server to your production PostgreSQL URL (e.g. DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?schema=public") and restart the app.'
    );
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
