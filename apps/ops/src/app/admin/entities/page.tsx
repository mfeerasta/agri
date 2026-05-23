import { eq } from 'drizzle-orm';
import { db, entities, entityRelationships } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { addEntityRelationship } from '../../finance/consolidation/actions';

export const dynamic = 'force-dynamic';

interface TreeNode {
  entityId: string;
  code: string;
  name: string;
  ownershipPct: number;
  method: string;
  children: TreeNode[];
}

async function buildTree(parentId: string, allEntities: Map<string, { code: string; name: string }>): Promise<TreeNode | null> {
  const ent = allEntities.get(parentId);
  if (!ent) return null;
  const rels = await db
    .select()
    .from(entityRelationships)
    .where(eq(entityRelationships.parentEntityId, parentId));
  const children: TreeNode[] = [];
  for (const r of rels) {
    const c = await buildTree(r.childEntityId, allEntities);
    if (c) {
      c.ownershipPct = Number(r.ownershipPct);
      c.method = r.consolidationMethod;
      children.push(c);
    }
  }
  return { entityId: parentId, code: ent.code, name: ent.name, ownershipPct: 100, method: 'full', children };
}

function TreeView({ node, depth = 0 }: { node: TreeNode; depth?: number }): React.JSX.Element {
  return (
    <div style={{ marginLeft: depth * 24 }} className="border-l border-[var(--paper-2)] pl-3">
      <div className="flex items-center gap-2 py-1">
        <span className="smallcaps text-xs text-[var(--zameen-600)]">{node.code}</span>
        <span className="text-sm font-semibold">{node.name}</span>
        {depth > 0 && (
          <>
            <span className="smallcaps text-xs">{node.method}</span>
            <span className="tabular text-xs">{node.ownershipPct.toFixed(2)}%</span>
          </>
        )}
      </div>
      {node.children.map((c) => (
        <TreeView key={c.entityId} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default async function EntitiesOrgChart() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const allRows = await db.select({ id: entities.id, code: entities.code, name: entities.name }).from(entities);
  const allMap = new Map(allRows.map((e) => [e.id, { code: e.code, name: e.name }]));
  const tree = entityId ? await buildTree(entityId, allMap) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Masthead section="Group org chart" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          {tree ? <TreeView node={tree} /> : <p className="text-sm">No entities.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add child entity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addEntityRelationship} className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Parent</label>
              <select name="parentEntityId" className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" defaultValue={entityId} required>
                {allRows.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Child</label>
              <select name="childEntityId" className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" required>
                {allRows
                  .filter((e) => e.id !== entityId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} {e.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Ownership %</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="ownershipPct"
                defaultValue="100"
                className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Method</label>
              <select name="consolidationMethod" className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" defaultValue="full">
                <option value="full">full</option>
                <option value="proportional">proportional</option>
                <option value="equity">equity</option>
                <option value="cost">cost</option>
              </select>
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Effective from</label>
              <input
                type="date"
                name="effectiveFrom"
                defaultValue={today}
                className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm"
                required
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-[var(--paper)]"
              >
                Add relationship
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
