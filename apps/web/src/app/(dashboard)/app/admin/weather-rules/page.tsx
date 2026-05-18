import { desc, eq } from 'drizzle-orm';
import { db, weatherAlertRules } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { WeatherRulesClient, type WeatherRuleRow } from '@/modules/admin/weather-rules-client';

export const dynamic = 'force-dynamic';

export default async function WeatherRulesPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const rows = await db
    .select()
    .from(weatherAlertRules)
    .where(eq(weatherAlertRules.entityId, ctx.entityId))
    .orderBy(desc(weatherAlertRules.createdAt));

  const view: WeatherRuleRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    conditionKind: r.conditionKind,
    threshold: (r.threshold ?? {}) as Record<string, number>,
    actionKind: r.actionKind,
    actionConfig: (r.actionConfig ?? {}) as Record<string, unknown>,
    lastFiredAt: r.lastFiredAt ? new Date(r.lastFiredAt as unknown as string).toISOString() : null,
    fireCount: r.fireCount,
  }));

  return (
    <div>
      <Masthead section="WEATHER RULES" />
      <SectionDivider />
      <WeatherRulesClient rows={view} />
    </div>
  );
}
