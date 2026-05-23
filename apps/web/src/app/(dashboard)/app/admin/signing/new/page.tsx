import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { db, entities } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { NewEnvelopeForm } from './new-envelope-form';

export const dynamic = 'force-dynamic';

export default async function NewSigningEnvelopePage() {
  const entityRows = await db.select({ id: entities.id, name: entities.name }).from(entities).orderBy(asc(entities.name));
  return (
    <div>
      <Masthead section="NEW SIGNING ENVELOPE" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Prepare a document for electronic signature</CardTitle>
        </CardHeader>
        <CardContent>
          <NewEnvelopeForm entities={entityRows} />
          <p className="mt-4 text-xs text-[var(--ink)]/60">
            Signed under the Electronic Transactions Ordinance 2002. Each signer receives a unique
            single-use link plus an OTP for identity verification. The PDF hash is anchored at
            creation; any later change is detectable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
