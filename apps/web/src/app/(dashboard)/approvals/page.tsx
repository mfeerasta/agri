import Link from 'next/link';
import { db, approvalRequests } from '@zameen/db';
import { desc, inArray, isNull, and } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, ApprovalBanner, Pkr } from '@zameen/ui';
import { t } from '@zameen/locale';
import { fmtDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ApprovalsListPage() {
  const locale = await getLocale();
  const pending = await db
    .select()
    .from(approvalRequests)
    .where(and(inArray(approvalRequests.state, ['submitted', 'in_review'] as never), isNull(approvalRequests.decidedAt)))
    .orderBy(desc(approvalRequests.submittedAt))
    .limit(50);
  const recent = await db
    .select()
    .from(approvalRequests)
    .where(inArray(approvalRequests.state, ['approved', 'executed', 'rejected'] as never))
    .orderBy(desc(approvalRequests.decidedAt))
    .limit(20);

  return (
    <div>
      <Masthead section={t('approvals.title', locale)} />
      <SectionDivider />
      <div className="flex justify-end px-1 py-2">
        <Link href={'/approvals/board' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] min-h-[44px] md:min-h-[40px] inline-flex items-center">
          {t('crops.board', locale)}
        </Link>
      </div>
      <Card className="mb-6">
        <CardHeader><CardTitle>{t('approvals.awaiting', locale)} · {pending.length}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">{t('approval.pending', locale)}: 0.</div> : (
            <ul>
              {pending.map((r) => (
                <li key={r.id} className="border-t border-[var(--rule)] px-4 py-3 first:border-0">
                  <a href={`${process.env.NEXT_PUBLIC_APPROVE_URL ?? ''}/${r.id}`} target="_blank" rel="noreferrer" className="block hover:underline">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-body">{r.title}</span>
                      {r.amountPkr ? <Pkr value={r.amountPkr} /> : null}
                    </div>
                    <ApprovalBanner state={r.state as never} amountPkr={r.amountPkr ?? undefined} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <SectionDivider label={t('approvals.recent', locale)} />
      <Card>
        <CardContent className="p-0">
          {recent.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">—</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">{t('audit.action', locale)}</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">{t('approval.threshold', locale)}</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">{t('common.rs', locale)}</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">{t('status.submitted', locale)}</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">{t('approvals.decided', locale)}</th>
                </tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-3 md:py-2">{r.title}</td>
                      <td className="px-3 py-3 md:py-2 smallcaps text-[0.7rem]">{r.approvalType}</td>
                      <td className="px-3 py-3 md:py-2 text-right">{r.amountPkr ? <Pkr value={r.amountPkr} /> : '—'}</td>
                      <td className="px-3 py-3 md:py-2 smallcaps text-[0.7rem]">{r.state}</td>
                      <td className="px-3 py-3 md:py-2 tabular text-xs">{fmtDate(r.decidedAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
