import { FieldRepairRequestForm } from './field-repair-request-form';

export default function NewRepairPage() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">مرمت کی درخواست</h1>
      <FieldRepairRequestForm />
    </main>
  );
}
