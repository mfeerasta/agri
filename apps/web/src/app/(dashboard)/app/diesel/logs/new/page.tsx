import { DieselDailyLogForm } from '@/modules/diesel/components/diesel-daily-log-form';

export default function NewDieselDailyLogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Daily diesel log</h1>
      <DieselDailyLogForm />
    </div>
  );
}
