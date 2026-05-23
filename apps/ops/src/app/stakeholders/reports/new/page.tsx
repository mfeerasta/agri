import { and, asc, eq } from 'drizzle-orm';
import { db, stakeholders } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { GenerateReportForm } from './generate-report-form';

export const dynamic = 'force-dynamic';

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ stakeholderId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity" description="Sign in." />;

  const list = await db
    .select({ id: stakeholders.id, name: stakeholders.name, kind: stakeholders.stakeholderKind })
    .from(stakeholders)
    .where(and(eq(stakeholders.entityId, entityId), eq(stakeholders.isActive, true)))
    .orderBy(asc(stakeholders.name));

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Generate stakeholder report" subtitle="Pick stakeholder, set period, write cover letter" />
      <Card>
        <CardHeader>
          <CardTitle>Report inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateReportForm stakeholders={list} initialStakeholderId={sp.stakeholderId} />
        </CardContent>
      </Card>
    </div>
  );
}
