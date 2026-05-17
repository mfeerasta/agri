import { db, blocks } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { FieldForm } from '@/modules/fields/components/field-form';

export const dynamic = 'force-dynamic';

export default async function NewFieldPage() {
  const blockRows = await db.select({ id: blocks.id, code: blocks.code, name: blocks.name }).from(blocks);
  return (
    <div className="space-y-2">
      <Masthead section="FIELDS / NEW" />
      <SectionDivider />
      <FieldForm blocks={blockRows} />
    </div>
  );
}
