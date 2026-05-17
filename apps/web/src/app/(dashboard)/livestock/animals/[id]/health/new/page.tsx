import { Masthead } from '@zameen/ui';
import { HealthForm } from '@/modules/livestock/components/health-form';
import { getSessionContext } from '@/lib/session';

export default async function NewHealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Masthead section="Livestock / Health event" />
      <HealthForm entityId={ctx?.entityId ?? ''} animalId={id} />
    </div>
  );
}
