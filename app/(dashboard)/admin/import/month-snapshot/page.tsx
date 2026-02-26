import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getOperationalScope } from '@/lib/scope/operationalScope';
import { prisma } from '@/lib/db';
import { MonthSnapshotUploadClient } from './MonthSnapshotUploadClient';

export default async function AdminMonthSnapshotPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/dashboard');

  const scope = await getOperationalScope();
  const boutiqueId = scope?.boutiqueId ?? user.boutiqueId ?? '';
  const defaultBranchCode =
    boutiqueId
      ? (await prisma.boutique.findUnique({ where: { id: boutiqueId }, select: { code: true } }))?.code ?? ''
      : '';

  return (
    <div className="min-w-0">
      <MonthSnapshotUploadClient defaultBranchCode={defaultBranchCode} />
    </div>
  );
}
