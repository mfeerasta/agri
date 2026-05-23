import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, bankAccounts } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ accounts: [] }, { status: 401 });
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.entityId, ctx.entityId));
  return NextResponse.json({
    accounts: rows.map((a) => ({
      id: a.id,
      label: `${a.bankName} - ${a.accountTitle} (${a.accountNumber})`,
    })),
  });
}
