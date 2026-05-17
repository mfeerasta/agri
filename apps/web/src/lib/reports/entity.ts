import { eq } from 'drizzle-orm';
import { db, entities, users } from '@zameen/db';

export async function getEntityName(entityId: string): Promise<string> {
  const [e] = await db.select({ name: entities.name }).from(entities).where(eq(entities.id, entityId)).limit(1);
  return e?.name ?? 'Unknown entity';
}

export async function getUserDisplayName(userId: string): Promise<string> {
  const [u] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.fullName ?? 'unknown';
}
