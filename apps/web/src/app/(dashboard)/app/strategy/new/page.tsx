import { NewPlanForm } from '@/modules/strategy/components/new-plan-form';

export const dynamic = 'force-dynamic';

export default function NewStrategicPlanPage() {
  const thisYear = new Date().getFullYear();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">New strategic plan</h1>
        <p className="text-sm text-slate-500">Establish a 5-year horizon with vision, current state, and target state.</p>
      </div>
      <NewPlanForm defaultStartYear={thisYear} />
    </div>
  );
}
