import { notFound } from 'next/navigation';
import { db, blocks, fields } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { FieldForm } from '@/modules/fields/components/field-form';

export const dynamic = 'force-dynamic';

export default async function EditFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [field] = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  if (!field) notFound();
  const blockRows = await db.select({ id: blocks.id, code: blocks.code, name: blocks.name }).from(blocks);

  return (
    <div className="space-y-2">
      <Masthead section={`FIELDS / ${field.code} / EDIT`} />
      <SectionDivider />
      <FieldForm
        blocks={blockRows}
        mode="edit"
        defaults={{
          id: field.id,
          blockId: field.blockId,
          code: field.code,
          name: field.name ?? undefined,
          nameUr: field.nameUr ?? undefined,
          acres: Number(field.acres),
          geometry: field.geometry as never,
          khasraNumbers: (field.khasraNumbers as string[]) ?? [],
          khatooniNumber: field.khatooniNumber ?? undefined,
          tenure: field.tenure,
        }}
      />
    </div>
  );
}
