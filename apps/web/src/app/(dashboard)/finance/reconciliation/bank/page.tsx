import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';

export default function InputReconciliationPage() {
  return (
    <div>
      <Masthead section="BANK RECON" />
      <SectionDivider />
      <EmptyState title="Bank statement reconciliation" body="Runs reconcileBank(entityId). Variances shown matched vs unmatched. UI hookup pending after first inventory load." />
    </div>
  );
}
