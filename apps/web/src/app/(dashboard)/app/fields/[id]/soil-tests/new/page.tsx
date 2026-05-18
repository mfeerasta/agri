import { Masthead, SectionDivider } from '@zameen/ui';
import { SoilTestForm } from '@/modules/fields/components/soil-test-form';

export default async function NewSoilTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-2">
      <Masthead section="SOIL TEST / NEW" />
      <SectionDivider />
      <SoilTestForm fieldId={id} />
    </div>
  );
}
