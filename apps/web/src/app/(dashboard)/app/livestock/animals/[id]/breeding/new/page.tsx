import { Masthead } from '@zameen/ui';
import { BreedingForm } from '@/modules/livestock/components/breeding-form';

export default async function NewBreedingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Masthead section="Livestock / Breeding event" />
      <BreedingForm animalId={id} />
    </div>
  );
}
