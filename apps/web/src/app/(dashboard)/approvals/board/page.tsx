import { desc } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import {
  SimpleBoardClient,
  type SimpleBoardItem,
} from '../../crops/board/simple-board-client';

export const dynamic = 'force-dynamic';

const STATE_GROUPS = [
  { id: 'draft', label: 'Draft', color: '#94a3b8' },
  { id: 'submitted', label: 'Submitted', color: '#60a5fa' },
  { id: 'in_review', label: 'In Review', color: '#38bdf8' },
  { id: 'approved', label: 'Approved', color: '#34d399' },
  { id: 'rejected', label: 'Rejected', color: '#f87171' },
  { id: 'sent_back', label: 'Sent Back', color: '#fbbf24' },
  { id: 'executed', label: 'Executed', color: '#22c55e' },
  { id: 'closed', label: 'Closed', color: '#64748b' },
  { id: 'emergency_executed', label: 'Emergency', color: '#dc2626' },
];

export default async function ApprovalsBoardPage() {
  const rows = await db
    .select()
    .from(approvalRequests)
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200);

  const items: SimpleBoardItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.state,
    startDate: r.submittedAt ? new Date(r.submittedAt) : r.createdAt ? new Date(r.createdAt) : null,
    endDate: r.decidedAt ? new Date(r.decidedAt) : null,
    href: `/approvals/${r.id}`,
    meta: {
      type: r.approvalType,
      amount: r.amountPkr ? `PKR ${Number(r.amountPkr).toLocaleString('en-PK')}` : '—',
    },
  }));

  return (
    <div>
      <Masthead section="APPROVALS · BOARD" />
      <SectionDivider label={`${items.length} requests`} />
      <div className="p-4">
        <SimpleBoardClient
          items={items}
          groups={STATE_GROUPS}
          available={['kanban', 'calendar', 'table']}
          metaColumns={[
            { key: 'type', label: 'Type' },
            { key: 'amount', label: 'Amount' },
          ]}
          emptyTitle="No approval requests"
        />
      </div>
    </div>
  );
}
