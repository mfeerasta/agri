'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, weatherAlertRules } from '@zameen/db';
import { z } from 'zod';
import { getSessionContext } from '@/lib/session';

const conditionKind = z.enum([
  'frost_warning',
  'heatwave',
  'heavy_rain',
  'strong_wind',
  'low_humidity',
  'drought_days',
]);
const actionKind = z.enum(['create_task', 'notify_supervisor', 'flag_field', 'suspend_spraying']);

const ruleInput = z.object({
  name: z.string().min(2).max(120),
  conditionKind,
  threshold: z.record(z.number()).default({}),
  actionKind,
  actionConfig: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export async function createWeatherRule(raw: unknown) {
  const parsed = ruleInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  const [row] = await db
    .insert(weatherAlertRules)
    .values({
      entityId: ctx.entityId,
      name: parsed.data.name,
      conditionKind: parsed.data.conditionKind,
      threshold: parsed.data.threshold,
      actionKind: parsed.data.actionKind,
      actionConfig: parsed.data.actionConfig,
      enabled: parsed.data.enabled,
    })
    .returning();
  revalidatePath('/admin/weather-rules');
  return { ok: true as const, id: row!.id };
}

export async function toggleWeatherRule(id: string, enabled: boolean) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  await db.update(weatherAlertRules).set({ enabled }).where(eq(weatherAlertRules.id, id));
  revalidatePath('/admin/weather-rules');
  return { ok: true as const, id };
}

export async function deleteWeatherRule(id: string) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  await db.delete(weatherAlertRules).where(eq(weatherAlertRules.id, id));
  revalidatePath('/admin/weather-rules');
  return { ok: true as const, id };
}

export interface RuleTemplate {
  key: string;
  name: string;
  conditionKind: z.infer<typeof conditionKind>;
  threshold: Record<string, number>;
  actionKind: z.infer<typeof actionKind>;
  actionConfig: Record<string, unknown>;
  blurb: string;
}

export const ruleTemplates: readonly RuleTemplate[] = [
  {
    key: 'frost-irrigate',
    name: 'Frost warning < 2C overnight',
    conditionKind: 'frost_warning',
    threshold: { minTempC: 2 },
    actionKind: 'create_task',
    actionConfig: { title: 'Run protective irrigation (frost risk)', taskKind: 'irrigation', priority: 'high' },
    blurb: 'Forecast min < 2C in next 72h. Auto-creates an irrigation task for tonight.',
  },
  {
    key: 'heatwave-flag',
    name: 'Heatwave > 40C for 3 days',
    conditionKind: 'heatwave',
    threshold: { maxTempC: 40, consecutiveDays: 3 },
    actionKind: 'notify_supervisor',
    actionConfig: {},
    blurb: 'Three consecutive days above 40C. Pings supervisor to plan heat-stress checks.',
  },
  {
    key: 'heavy-rain-suspend',
    name: 'Heavy rain > 30mm in 24h',
    conditionKind: 'heavy_rain',
    threshold: { rainfallMm: 30 },
    actionKind: 'suspend_spraying',
    actionConfig: {},
    blurb: 'Suspends spraying entity-wide. UI shows a banner on the spray planner.',
  },
  {
    key: 'strong-wind-suspend',
    name: 'Strong wind > 25 kph forecast',
    conditionKind: 'strong_wind',
    threshold: { windKph: 25 },
    actionKind: 'suspend_spraying',
    actionConfig: {},
    blurb: 'Drift risk too high. Suspends spraying until wind drops.',
  },
  {
    key: 'drought-notify',
    name: 'Drought: no rain for 21 days',
    conditionKind: 'drought_days',
    threshold: { consecutiveDays: 21 },
    actionKind: 'notify_supervisor',
    actionConfig: {},
    blurb: 'Notifies the director of prolonged dryness so irrigation budget can be reviewed.',
  },
];

export async function installTemplate(key: string) {
  const tpl = ruleTemplates.find((r) => r.key === key);
  if (!tpl) return { ok: false as const, error: 'Unknown template' };
  return createWeatherRule({
    name: tpl.name,
    conditionKind: tpl.conditionKind,
    threshold: tpl.threshold,
    actionKind: tpl.actionKind,
    actionConfig: tpl.actionConfig,
    enabled: true,
  });
}
