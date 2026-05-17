import { Masthead, SectionDivider } from '@zameen/ui';
import { HourMeterForm } from '@/modules/inventory/components/hour-meter-form';

export default async function NewHourMeterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-2">
      <Masthead section="ASSET / HOUR METER" />
      <SectionDivider />
      <HourMeterForm assetId={id} />
    </div>
  );
}
