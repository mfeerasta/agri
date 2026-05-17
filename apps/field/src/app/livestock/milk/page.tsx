import { BulkMilkForm } from './bulk-milk-form';
export default function MilkPage() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-3">
      <h1 className="font-display text-2xl text-[var(--zameen-700)]">دودھ</h1>
      <BulkMilkForm />
    </main>
  );
}
