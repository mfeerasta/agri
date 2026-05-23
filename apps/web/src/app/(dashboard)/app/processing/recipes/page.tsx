/**
 * Recipe library: list active processing recipes and offer a quick-create form.
 */
import Link from 'next/link';
import { listRecipes } from '@/modules/processing/actions';
import { getSessionContext } from '@/lib/session';
import { NewRecipeForm } from '@/modules/processing/components/new-recipe-form';

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view recipes.</div>;
  const recipes = await listRecipes();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Processing recipes</h1>
        <p className="text-sm text-slate-500">
          Bill of materials for each conversion: wheat to flour, sugarcane to gur, milk to butter.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Recipe</th>
                <th className="px-3 py-2">Process</th>
                <th className="px-3 py-2">Inputs</th>
                <th className="px-3 py-2">Outputs</th>
                <th className="px-3 py-2">Expected yield</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No recipes yet. Define your first bill of materials on the right.
                  </td>
                </tr>
              )}
              {recipes.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.processKind.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    {r.inputs.map((i) => `${i.quantityKg}kg ${i.crop}`).join(', ')}
                  </td>
                  <td className="px-3 py-2">
                    {r.outputs.map((o) => `${o.quantityKg}kg ${o.name}`).join(', ')}
                  </td>
                  <td className="px-3 py-2">
                    {r.expectedTotalYieldPct ? `${Number(r.expectedTotalYieldPct).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/processing/runs/new?recipe=${r.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      Run
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <NewRecipeForm />
      </div>
    </div>
  );
}
