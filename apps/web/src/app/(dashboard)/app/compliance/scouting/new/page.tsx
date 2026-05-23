import { Masthead, SectionDivider } from '@zameen/ui';
import { listFieldOptions } from '@/modules/compliance/scouting-actions';
import { listCropPlanOptions } from '@/modules/compliance/spray-planner-actions';
import { ScoutingFormClient } from '@/modules/compliance/scouting-form-client';

export const dynamic = 'force-dynamic';

const COMMON_PESTS = [
  'yellow_rust',
  'leaf_rust',
  'aphid',
  'armyworm',
  'fall_armyworm',
  'stem_borer',
  'whitefly',
  'pink_bollworm',
  'brown_plant_hopper',
  'jassid',
  'thrips',
  'mealybug',
  'powdery_mildew',
  'downy_mildew',
  'blast',
  'bacterial_blight',
];

export default async function ScoutingNewPage() {
  const [fields, plans] = await Promise.all([listFieldOptions(), listCropPlanOptions()]);
  return (
    <div className="max-w-2xl">
      <Masthead section="NEW SCOUTING OBSERVATION" />
      <SectionDivider />
      <ScoutingFormClient fieldOptions={fields} cropPlanOptions={plans} commonPests={COMMON_PESTS} />
    </div>
  );
}
