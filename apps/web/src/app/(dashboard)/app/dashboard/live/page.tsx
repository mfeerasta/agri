import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { getRecentLiveActivity } from '@/modules/dashboard/live-activity-data';
import { LiveActivityFeed } from '@/modules/dashboard/components/live-activity-feed';

export const dynamic = 'force-dynamic';

export default async function LiveActivityPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  if (!session.entityId) redirect('/app');

  const initial = await getRecentLiveActivity(session.entityId, { limit: 50 });

  return (
    <div className="flex flex-col h-full">
      <Masthead section="LIVE ACTIVITY" />
      <SectionDivider />
      <p className="text-sm text-zinc-600 mb-3">
        Realtime field activity. Updates stream as workers log diesel, issue inputs, record
        harvests, file safety incidents, or submit approvals.
      </p>
      <LiveActivityFeed entityId={session.entityId} initial={initial} max={100} />
    </div>
  );
}
