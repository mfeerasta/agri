import { DieselPurchaseForm } from '@/modules/diesel/components/diesel-purchase-form';

export default function NewDieselPurchasePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">New diesel purchase</h1>
      <DieselPurchaseForm />
    </div>
  );
}
