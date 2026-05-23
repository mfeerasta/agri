import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db, cropVarieties, fields, cropPlans } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { NewTrialForm } from './new-trial-form';

export const dynamic = 'force-dynamic';

export default async function NewTrialPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');

  const [varieties, fieldRows, plans] = await Promise.all([
    db.select().from(cropVarieties).orderBy(asc(cropVarieties.name)),
    db.select({ id: fields.id, code: fields.code, name: fields.name }).from(fields).orderBy(asc(fields.code)),
    db
      .select({ id: cropPlans.id, fieldId: cropPlans.fieldId, seasonLabel: cropPlans.seasonLabel })
      .from(cropPlans),
  ]);

  return (
    <div>
      <Masthead section="VARIETY TRIAL / NEW" />
      <SectionDivider />
      <div className="p-4 max-w-2xl">
        <NewTrialForm
          varieties={varieties.map((v) => ({ id: v.id, name: v.name, crop: v.cropProfileCode }))}
          fields={fieldRows}
          plans={plans}
        />
      </div>
    </div>
  );
}
