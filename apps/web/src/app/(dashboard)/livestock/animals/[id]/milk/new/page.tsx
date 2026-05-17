import { Masthead } from '@zameen/ui';
import { MilkForm } from '@/modules/livestock/components/milk-form';

export default async function NewMilkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Masthead section="Livestock / Milk record" />
      <MilkForm animalId={id} />
    </div>
  );
}
