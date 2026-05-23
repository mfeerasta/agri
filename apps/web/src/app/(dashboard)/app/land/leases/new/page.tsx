import { db, fields, blocks, farms } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { LeaseForm } from '@/modules/land/components/lease-form';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewLeasePage(): Promise<React.JSX.Element> {
  const ctx = await getSessionContext();
  const fieldRows = await db
    .select({
      id: fields.id,
      code: fields.code,
      name: fields.name,
      farmName: farms.name,
      blockCode: blocks.code,
    })
    .from(fields)
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .leftJoin(farms, eq(farms.id, blocks.farmId))
    .orderBy(fields.code);

  return (
    <div className="space-y-2">
      <Masthead section="New lease · نیا معاہدہ" />
      <SectionDivider />
      <LeaseForm entityId={ctx?.entityId ?? ''} fields={fieldRows} />
    </div>
  );
}
