/**
 * Default preventive-maintenance plan templates by asset category.
 *
 * Call seedMaintenancePlansForAsset(assetId) right after a new asset
 * is created — it inserts the standard plan set for that category.
 */

import { eq } from 'drizzle-orm';
import { db, assets, maintenancePlans } from '@zameen/db';
import type { MaintenancePartRequired, MaintenanceTaskTemplateStep, MaintenanceTriggerKind } from '@zameen/db';

export interface MaintenanceTemplate {
  name: string;
  triggerKind: MaintenanceTriggerKind;
  triggerValue: number;
  taskTemplate: MaintenanceTaskTemplateStep[];
  partsRequired: MaintenancePartRequired[];
  estimatedCostPkr: number;
  estimatedDowntimeHours: number;
}

export const MAINTENANCE_TEMPLATES: Record<string, MaintenanceTemplate[]> = {
  tractor: [
    {
      name: 'Engine oil + filter change',
      triggerKind: 'hour_meter',
      triggerValue: 250,
      taskTemplate: [
        { step: 'Drain engine oil', stepUr: 'تیل نکالیں', required: true },
        { step: 'Replace oil filter', stepUr: 'فلٹر بدلیں', required: true },
        { step: 'Refill with 15W-40 to dipstick line', required: true },
        { step: 'Run engine 5 min and re-check level', required: true },
      ],
      partsRequired: [
        { name: 'Engine oil 15W-40', quantity: 7, unitCostPkr: 1100 },
        { name: 'Oil filter', quantity: 1, unitCostPkr: 1200 },
      ],
      estimatedCostPkr: 9500,
      estimatedDowntimeHours: 1.5,
    },
    {
      name: 'Fuel filter replacement',
      triggerKind: 'hour_meter',
      triggerValue: 500,
      taskTemplate: [
        { step: 'Close fuel valve', required: true },
        { step: 'Replace primary and secondary fuel filters', required: true },
        { step: 'Bleed fuel lines', required: true },
      ],
      partsRequired: [
        { name: 'Primary fuel filter', quantity: 1, unitCostPkr: 1400 },
        { name: 'Secondary fuel filter', quantity: 1, unitCostPkr: 1800 },
      ],
      estimatedCostPkr: 4500,
      estimatedDowntimeHours: 1,
    },
    {
      name: 'Air filter clean / replace',
      triggerKind: 'hour_meter',
      triggerValue: 100,
      taskTemplate: [
        { step: 'Remove air filter housing', required: true },
        { step: 'Blow out element with compressed air or replace', required: true },
      ],
      partsRequired: [{ name: 'Air filter element', quantity: 1, unitCostPkr: 950 }],
      estimatedCostPkr: 1500,
      estimatedDowntimeHours: 0.5,
    },
    {
      name: 'Tire pressure check',
      triggerKind: 'days_elapsed',
      triggerValue: 7,
      taskTemplate: [
        { step: 'Check front and rear tire pressure cold', required: true },
        { step: 'Top up to manufacturer spec', required: true },
      ],
      partsRequired: [],
      estimatedCostPkr: 0,
      estimatedDowntimeHours: 0.25,
    },
    {
      name: 'Hydraulic oil + filter',
      triggerKind: 'hour_meter',
      triggerValue: 1000,
      taskTemplate: [
        { step: 'Drain hydraulic reservoir', required: true },
        { step: 'Replace hydraulic filter', required: true },
        { step: 'Refill with ISO 68 hydraulic oil', required: true },
      ],
      partsRequired: [
        { name: 'Hydraulic oil ISO 68', quantity: 30, unitCostPkr: 850 },
        { name: 'Hydraulic filter', quantity: 1, unitCostPkr: 3200 },
      ],
      estimatedCostPkr: 30000,
      estimatedDowntimeHours: 3,
    },
  ],
  implement: [
    {
      name: 'Greasing all pivots',
      triggerKind: 'hour_meter',
      triggerValue: 50,
      taskTemplate: [
        { step: 'Apply grease to all zerk fittings', required: true },
        { step: 'Wipe excess', required: true },
      ],
      partsRequired: [{ name: 'Lithium grease', quantity: 1, unitCostPkr: 600 }],
      estimatedCostPkr: 800,
      estimatedDowntimeHours: 0.5,
    },
    {
      name: 'Blade / tine sharpening',
      triggerKind: 'days_elapsed',
      triggerValue: 180,
      taskTemplate: [
        { step: 'Remove blades / tines', required: true },
        { step: 'Sharpen on grinder', required: true },
        { step: 'Reinstall and torque', required: true },
      ],
      partsRequired: [],
      estimatedCostPkr: 3500,
      estimatedDowntimeHours: 4,
    },
  ],
  generator: [
    {
      name: 'Generator oil + coolant + battery',
      triggerKind: 'hour_meter',
      triggerValue: 200,
      taskTemplate: [
        { step: 'Change engine oil', required: true },
        { step: 'Check coolant level + top up', required: true },
        { step: 'Test battery voltage', required: true },
      ],
      partsRequired: [
        { name: 'Engine oil 15W-40', quantity: 4, unitCostPkr: 1100 },
        { name: 'Coolant', quantity: 2, unitCostPkr: 800 },
      ],
      estimatedCostPkr: 7500,
      estimatedDowntimeHours: 1.5,
    },
  ],
  pump: [
    {
      name: 'Impeller inspection',
      triggerKind: 'hour_meter',
      triggerValue: 2000,
      taskTemplate: [
        { step: 'Disconnect pump head', required: true },
        { step: 'Inspect impeller for wear / pitting', required: true },
        { step: 'Replace if eroded beyond 2mm', required: true },
      ],
      partsRequired: [{ name: 'Impeller (spare)', quantity: 1, unitCostPkr: 8500 }],
      estimatedCostPkr: 12000,
      estimatedDowntimeHours: 4,
    },
  ],
};

export async function seedMaintenancePlansForAsset(assetId: string): Promise<number> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  let category = asset.category as string;
  // Map sub-categories to template buckets.
  if (category === 'tubewell') category = 'pump';
  if (category === 'harvester' || category === 'thresher' || category === 'sprayer') category = 'tractor';

  const templates = MAINTENANCE_TEMPLATES[category] ?? [];
  if (templates.length === 0) return 0;

  await db.insert(maintenancePlans).values(
    templates.map((t) => ({
      assetId,
      name: t.name,
      triggerKind: t.triggerKind,
      triggerValue: t.triggerValue.toString(),
      taskTemplate: t.taskTemplate,
      partsRequired: t.partsRequired,
      estimatedCostPkr: t.estimatedCostPkr.toString(),
      estimatedDowntimeHours: t.estimatedDowntimeHours.toString(),
      isActive: true,
    })),
  );
  return templates.length;
}
