import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { InputMasterForm } from '@/modules/inventory/components/input-form';
import { getSessionContext } from '@/lib/session';

export default async function NewInputPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  return (
    <div className="space-y-2">
      <Masthead section="INPUTS / NEW" />
      <SectionDivider />
      <InputMasterForm entityId={ctx.entityId} />
    </div>
  );
}
