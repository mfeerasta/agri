import { Masthead, SectionDivider } from '@zameen/ui';
import { AdvisoryUploadForm } from '@/modules/admin/components/advisory-upload-form';
import { AdvisoryList } from '@/modules/admin/components/advisory-list';
import { searchAdvisories } from '@/modules/admin/advisory-actions';

export default async function AdvisoriesPage() {
  const recent = await searchAdvisories({ limit: 20 });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Masthead section="EXTERNAL CROP ADVISORIES" />
      <SectionDivider />
      <AdvisoryUploadForm />
      <SectionDivider />
      <AdvisoryList advisories={recent} />
    </div>
  );
}
