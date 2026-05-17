// Minimal seed: just enough to boot the apps.
// Auth users, AGRI entity, entity_settings, 14 approval workflows.

import { db, sql } from './index.js';
import { entities, entitySettings, approvalWorkflows, users, userEntityRoles } from './schema/index.js';

const DEFAULT_THRESHOLDS = {
  feasibility_study: { supervisor: 0, farm_manager: 0, director: 0 },
  input_purchase: { supervisor: 25_000, farm_manager: 100_000, director: null },
  diesel_purchase: { supervisor: 25_000, farm_manager: 50_000, director: null },
  repair: { supervisor: 10_000, farm_manager: 50_000, director: null },
  asset_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_purchase: { supervisor: 0, farm_manager: 0, director: null },
  livestock_sale: { supervisor: 0, farm_manager: 0, director: null },
  crop_sale: { supervisor: 0, farm_manager: 500_000, director: null },
  labor_hire: { supervisor: 0, farm_manager: 0, director: null },
  lease: { supervisor: 0, farm_manager: 0, director: 0 },
  capex: { supervisor: 0, farm_manager: 0, director: null },
  land_transaction: { supervisor: 0, farm_manager: 0, director: 0 },
  tax_payment: { supervisor: 0, farm_manager: 0, director: null },
  loan: { supervisor: 0, farm_manager: 0, director: 0 },
};

const AUTH_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', fullName: 'Meer Feerasta', primaryRole: 'director' as const, phone: '+923000000001' },
  { id: '22222222-2222-2222-2222-222222222222', fullName: 'Farm Manager 1', primaryRole: 'farm_manager' as const, phone: '+923000000002' },
  { id: '33333333-3333-3333-3333-333333333333', fullName: 'Supervisor Raiwind 1', primaryRole: 'supervisor' as const, phone: '+923000000003' },
  { id: '44444444-4444-4444-4444-444444444444', fullName: 'Supervisor Raiwind 2', primaryRole: 'supervisor' as const, phone: '+923000000004' },
];

export async function seedMinimal() {
  console.log('Seeding AGRI entity (minimal)...');
  const [agri] = await db
    .insert(entities)
    .values({ code: 'AGRI', name: 'Rupafab Agri', legalName: 'Rupafab Limited (Agriculture Operation)', approvalThresholds: DEFAULT_THRESHOLDS })
    .onConflictDoNothing()
    .returning();

  const entityId =
    agri?.id ?? (await db.select().from(entities).where(/* lookup by code */ undefined as never).limit(1))[0]?.id;

  if (!entityId) throw new Error('Failed to find/create AGRI entity');

  await db.insert(entitySettings).values({ entityId, approvalThresholds: DEFAULT_THRESHOLDS }).onConflictDoNothing();

  console.log('Seeding 4 auth users...');
  for (const u of AUTH_USERS) {
    await db.insert(users).values({ ...u, defaultEntityId: entityId }).onConflictDoNothing();
    await db
      .insert(userEntityRoles)
      .values({ userId: u.id, entityId, role: u.primaryRole })
      .onConflictDoNothing();
  }

  console.log('Seeding 14 approval workflows...');
  for (const [type, thresholds] of Object.entries(DEFAULT_THRESHOLDS)) {
    await db
      .insert(approvalWorkflows)
      .values({ entityId, approvalType: type as never, thresholdsPkr: thresholds })
      .onConflictDoNothing();
  }
  return entityId;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedMinimal()
    .then(() => sql.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
