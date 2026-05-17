import { and, eq } from 'drizzle-orm';
import { db, inputs, fields, workers } from '@zameen/db';
import { Masthead } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { IssueForm } from './issue-form';

export const dynamic = 'force-dynamic';

export default async function IssuePage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const inputRows = entityId
    ? await db
        .select()
        .from(inputs)
        .where(and(eq(inputs.entityId, entityId), eq(inputs.isActive, true)))
    : [];

  const fieldRows = entityId ? await db.select().from(fields).where(eq(fields.entityId, entityId)) : [];

  const workerRows = entityId
    ? await db
        .select()
        .from(workers)
        .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="Input Issuance" />
      <IssueForm
        entityId={entityId}
        inputs={inputRows.map((i) => ({ id: i.id, name: i.name, unit: i.unit, type: i.type }))}
        fields={fieldRows.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          acres: Number(f.acres ?? 0),
        }))}
        workers={workerRows.map((w) => ({ id: w.id, code: w.code, fullName: w.fullName }))}
      />
    </div>
  );
}
