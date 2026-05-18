import { Masthead } from '@zameen/ui';
import { AnimalForm } from '@/modules/livestock/components/animal-form';
import { getSessionContext } from '@/lib/session';

export default async function NewAnimalPage() {
  const ctx = await getSessionContext();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="Livestock / Register animal" />
      <AnimalForm entityId={ctx?.entityId ?? ''} />
    </div>
  );
}
