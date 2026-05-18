import { RepairRequestForm } from '@/modules/repairs/components/repair-request-form';

export default function NewRepairRequestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Report repair issue</h1>
      <RepairRequestForm />
    </div>
  );
}
