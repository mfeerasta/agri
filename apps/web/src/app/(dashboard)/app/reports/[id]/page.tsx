import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getCustomReport, runReport } from '@/modules/custom-reports/actions';
import { ReportView } from '@/modules/custom-reports/report-view';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getCustomReport(id);
  if (!report) notFound();
  const result = await runReport(id);

  return (
    <div>
      <Masthead section={report.name.toUpperCase()} />
      <SectionDivider />
      <div className="flex justify-end mb-3">
        <Link
          href={`/reports/${id}/schedule` as never}
          className="text-xs px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)]"
        >
          Schedule delivery
        </Link>
      </div>
      <ReportView reportName={report.name} result={result} />
    </div>
  );
}
