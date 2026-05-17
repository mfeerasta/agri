import { HarvestFieldForm } from './harvest-field-form';

export default function NewHarvestPage() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">نئی کٹائی</h1>
      <HarvestFieldForm />
    </main>
  );
}
