import { Masthead, SectionDivider } from '@zameen/ui';
import { WorkerForm } from '@/modules/labor/components/worker-form';

export default function NewWorkerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Masthead section="HIRE WORKER" />
      <SectionDivider />
      <WorkerForm />
    </div>
  );
}
