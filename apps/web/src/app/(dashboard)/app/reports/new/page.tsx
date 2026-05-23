import { Masthead, SectionDivider } from '@zameen/ui';
import { ReportWizard } from '@/modules/custom-reports/report-wizard';

export const dynamic = 'force-dynamic';

export default function NewReportPage() {
  return (
    <div>
      <Masthead section="NEW REPORT" />
      <SectionDivider />
      <ReportWizard />
    </div>
  );
}
