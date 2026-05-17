import { Masthead, SectionDivider } from '@zameen/ui';
import { PayrollRunForm } from '@/modules/labor/components/payroll-run-form';

export default function NewPayrollPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Masthead section="NEW PAYROLL RUN" />
      <SectionDivider />
      <PayrollRunForm />
    </div>
  );
}
