import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';

export default function InputReconciliationPage() {
  return (
    <div>
      <Masthead section="INPUT RECON" />
      <SectionDivider />
      <EmptyState title="Input stock reconciliation" body="Runs reconcileInputStock(entityId). Variances shown by input. UI hookup pending after first inventory load." />
    </div>
  );
}
