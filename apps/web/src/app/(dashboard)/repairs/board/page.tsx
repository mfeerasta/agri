import { desc, eq } from 'drizzle-orm';
import { db, repairRequests, assets } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import {
  SimpleBoardClient,
  type SimpleBoardItem,
} from '../../crops/board/simple-board-client';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { id: 'reported', label: 'Reported', color: '#94a3b8' },
  { id: 'quotes_pending', label: 'Quotes Pending', color: '#60a5fa' },
  { id: 'approval_pending', label: 'Approval Pending', color: '#fbbf24' },
  { id: 'approved', label: 'Approved', color: '#34d399' },
  { id: 'in_progress', label: 'In Progress', color: '#38bdf8' },
  { id: 'completed', label: 'Completed', color: '#22c55e' },
  { id: 'cancelled', label: 'Cancelled', color: '#f87171' },
];

export default async function RepairsBoardPage() {
  const rows = await db
    .select({
      id: repairRequests.id,
      number: repairRequests.requestNumber,
      issue: repairRequests.issueDescription,
      severity: repairRequests.severity,
      status: repairRequests.status,
      reportedAt: repairRequests.reportedAt,
      assetCode: assets.code,
      assetMake: assets.make,
      assetModel: assets.model,
    })
    .from(repairRequests)
    .leftJoin(assets, eq(assets.id, repairRequests.assetId))
    .orderBy(desc(repairRequests.reportedAt));

  const items: SimpleBoardItem[] = rows.map((r) => ({
    id: r.id,
    title: `${r.number} · ${r.assetCode ?? 'Asset'}${r.assetMake ? ` ${r.assetMake}` : ''}${r.assetModel ? ` ${r.assetModel}` : ''}`,
    status: r.status,
    startDate: r.reportedAt ? new Date(r.reportedAt) : null,
    endDate: r.reportedAt ? new Date(r.reportedAt) : null,
    href: `/repairs/${r.id}`,
    meta: {
      issue: r.issue.slice(0, 60),
      severity: r.severity,
    },
  }));

  return (
    <div>
      <Masthead section="REPAIRS · BOARD" />
      <SectionDivider label={`${items.length} requests`} />
      <div className="p-4">
        <SimpleBoardClient
          items={items}
          groups={STATUS_GROUPS}
          available={['kanban', 'calendar', 'table']}
          filterEnums={[
            {
              key: 'severity',
              label: 'Severity',
              options: [
                { value: 'operational', label: 'Operational' },
                { value: 'minor', label: 'Minor' },
                { value: 'major', label: 'Major' },
                { value: 'breakdown', label: 'Breakdown' },
              ],
            },
          ]}
          metaColumns={[
            { key: 'severity', label: 'Severity' },
            { key: 'issue', label: 'Issue' },
          ]}
          emptyTitle="No repair requests"
        />
      </div>
    </div>
  );
}
