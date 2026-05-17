import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { AssetForm } from '@/modules/inventory/components/asset-form';
import { getSessionContext } from '@/lib/session';

export default async function NewAssetPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  return (
    <div className="space-y-2">
      <Masthead section="ASSETS / NEW" />
      <SectionDivider />
      <AssetForm entityId={ctx.entityId} />
    </div>
  );
}
