import { db, entities } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { UploadDocumentForm } from './upload-form';

export const dynamic = 'force-dynamic';

const DOC_KINDS = [
  'land_record_fard',
  'khasra_girdawari',
  'registry_deed',
  'intiqal',
  'mutation',
  'water_rate_receipt',
  'abiana_bill',
  'electricity_subsidy_certificate',
  'kissan_card',
  'crop_loan_agreement',
  'crop_insurance_policy',
  'plant_health_certificate',
  'export_phytosanitary',
  'pesticide_dealer_license',
  'tractor_registration',
  'driver_license',
  'nadra_cnic',
  'passport',
  'ntn_certificate',
  'strn_certificate',
  'lease_deed',
  'partnership_deed',
  'board_resolution',
  'power_of_attorney',
  'other',
];

export default async function NewComplianceDocumentPage() {
  const ents = await db.select({ id: entities.id, name: entities.name }).from(entities).limit(50);
  return (
    <div>
      <Masthead section="UPLOAD DOCUMENT" />
      <SectionDivider />
      <UploadDocumentForm entities={ents} docKinds={DOC_KINDS} />
    </div>
  );
}
