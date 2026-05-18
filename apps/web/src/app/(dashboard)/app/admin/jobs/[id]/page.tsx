import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, jobRuns } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, StatusLabel } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobRunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
  if (!row) notFound();

  return (
    <div>
      <Masthead section={`JOB RUN · ${row.jobName}`} />
      <SectionDivider />

      <div className="mb-3 flex items-center gap-3 text-xs">
        <Link href="/admin/jobs" className="underline">Back to jobs</Link>
        <StatusLabel status={row.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card><CardHeader><CardTitle>Started</CardTitle></CardHeader><CardContent className="tabular text-sm">{new Date(row.startedAt).toLocaleString()}</CardContent></Card>
        <Card><CardHeader><CardTitle>Completed</CardTitle></CardHeader><CardContent className="tabular text-sm">{row.completedAt ? new Date(row.completedAt).toLocaleString() : '-'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Duration</CardTitle></CardHeader><CardContent className="tabular text-sm">{row.durationMs ?? '-'} ms</CardContent></Card>
        <Card><CardHeader><CardTitle>Records processed</CardTitle></CardHeader><CardContent className="tabular text-sm">{row.recordsProcessed ?? '-'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Kind</CardTitle></CardHeader><CardContent className="text-sm">{row.jobKind}</CardContent></Card>
        <Card><CardHeader><CardTitle>Triggered by</CardTitle></CardHeader><CardContent className="tabular text-xs">{row.triggeredBy ?? '-'}</CardContent></Card>
      </div>

      {row.errorMessage ? (
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <pre className="font-mono text-xs whitespace-pre-wrap text-rose-700 bg-rose-50 p-3 rounded-md">{row.errorMessage}</pre>
          </CardContent>
        </Card>
      ) : null}

      {row.payload ? (
        <Card>
          <CardHeader><CardTitle>Payload</CardTitle></CardHeader>
          <CardContent>
            <pre className="font-mono text-xs overflow-auto bg-[var(--paper-2)] p-3 rounded-md">{JSON.stringify(row.payload, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
