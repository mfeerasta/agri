import Link from 'next/link';
import { getSessionContext } from '@/lib/session';
import { getRecentLiveActivity } from '../live-activity-data';
import { LiveActivityFeed } from './live-activity-feed';

interface LiveActivityWidgetProps {
  fieldId?: string;
  max?: number;
}

export async function LiveActivityWidget({ fieldId, max = 20 }: LiveActivityWidgetProps) {
  const session = await getSessionContext();
  if (!session?.entityId) return null;
  const initial = await getRecentLiveActivity(session.entityId, { fieldId, limit: max });

  return (
    <section className="rounded-lg border border-zinc-200 p-4 bg-white">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-700">
          Live activity
        </h3>
        <Link
          href={fieldId ? `/app/fields/${fieldId}` : '/app/dashboard/live'}
          className="text-xs text-[var(--accent)] underline decoration-dotted"
        >
          View all
        </Link>
      </header>
      <LiveActivityFeed
        entityId={session.entityId}
        fieldId={fieldId}
        initial={initial}
        max={max}
        compact
      />
    </section>
  );
}
