import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';

export default function InputReconciliationPage() {
  return (
    <div>
      <Masthead section="DIESEL RECON" />
      <SectionDivider />
      <EmptyState title="Diesel tank stock reconciliation" body="Runs reconcileDieselStock(entityId). Variances shown by tank. UI hookup pending after first inventory load." />
    </div>
  );
}
