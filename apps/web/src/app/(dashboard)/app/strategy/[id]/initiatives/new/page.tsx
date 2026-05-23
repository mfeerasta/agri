/**
 * Propose a strategic initiative. Routes through Director approval per
 * DEFAULT_APPROVAL_THRESHOLDS_PKR.strategic_initiative.
 */
import { notFound } from 'next/navigation';
import { loadStrategicPlan } from '@/modules/strategy/actions';
import { NewInitiativeForm } from '@/modules/strategy/components/new-initiative-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewInitiativePage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadStrategicPlan(id);
  if (!data) return notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Propose initiative</h1>
        <p className="text-sm text-slate-500">
          Plan: <span className="font-medium">{data.plan.name}</span>. Submission opens a Director approval request.
        </p>
      </div>
      <NewInitiativeForm planId={data.plan.id} baseYear={data.plan.startYear} horizonYears={data.plan.horizonYears} />
    </div>
  );
}
