/**
 * Execute a processing run: pick a recipe, enter actual inputs/outputs/byproducts,
 * costs, and post.
 */
import { listRecipes } from '@/modules/processing/actions';
import { getSessionContext } from '@/lib/session';
import { RunForm } from '@/modules/processing/components/run-form';

export const dynamic = 'force-dynamic';

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to record a run.</div>;
  const recipes = await listRecipes();
  const { recipe: preselect } = await searchParams;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">New processing run</h1>
        <p className="text-sm text-slate-500">
          Record what actually ran. Costs flow from input lots, energy meter, labour minutes, and overhead.
        </p>
      </div>
      <RunForm recipes={recipes} preselectRecipeId={preselect ?? null} />
    </div>
  );
}
