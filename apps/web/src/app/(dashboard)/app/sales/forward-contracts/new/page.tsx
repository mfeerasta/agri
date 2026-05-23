import { db, buyersCrm } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { NewForwardContractForm } from './form-client';

export const dynamic = 'force-dynamic';

export default async function NewForwardContractPage() {
  const buyers = await db.select({ id: buyersCrm.id, name: buyersCrm.name, nameUr: buyersCrm.nameUr })
    .from(buyersCrm)
    .where(eq(buyersCrm.status, 'active'));
  return (
    <div>
      <Masthead section="NEW FORWARD CONTRACT" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Pre-harvest commitment / فصل سے پہلے کا معاہدہ</CardTitle></CardHeader>
        <CardContent>
          <NewForwardContractForm buyers={buyers} />
        </CardContent>
      </Card>
    </div>
  );
}
