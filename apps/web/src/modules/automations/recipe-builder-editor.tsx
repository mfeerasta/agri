'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionKind, Condition, TriggerKind } from '@zameen/automations';
import { updateRecipe, deleteRecipe, testRun } from './actions';
import { RecipeBuilder } from './recipe-builder';

export interface RecipeBuilderEditorProps {
  id: string;
  triggerKinds: TriggerKind[];
  initial: {
    name: string;
    triggerKind: TriggerKind;
    conditions: Condition[];
    actions: Array<{ kind: ActionKind; config: Record<string, unknown> }>;
  };
}

export function RecipeBuilderEditor({ id, triggerKinds, initial }: RecipeBuilderEditorProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [testPayload, setTestPayload] = useState('{}');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <RecipeBuilder triggerKinds={triggerKinds} initial={initial} />

      <div className="border-t border-[var(--rule)] pt-4 flex flex-col gap-3">
        <div className="smallcaps text-[0.7rem]">Test run (dry, no actions executed)</div>
        <textarea
          value={testPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          rows={4}
          className="font-mono text-xs px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              start(async () => {
                try {
                  const payload = JSON.parse(testPayload);
                  const res = await testRun(id, payload);
                  setTestStatus(res.ok ? 'dry-run ok' : `error: ${res.error}`);
                } catch (err) {
                  setTestStatus(`invalid JSON: ${(err as Error).message}`);
                }
              })
            }
            disabled={pending}
            className="text-xs px-3 py-1 rounded border border-[var(--accent)] text-[var(--accent)]"
          >
            Run dry test
          </button>
          {testStatus ? <span className="text-xs text-[var(--fg-muted)]">{testStatus}</span> : null}
        </div>
      </div>

      <div className="border-t border-[var(--rule)] pt-4 flex justify-between items-center">
        <button
          type="button"
          onClick={() =>
            start(async () => {
              if (!confirm('Delete this recipe?')) return;
              const res = await deleteRecipe(id);
              if (res.ok) router.push('/admin/automations');
            })
          }
          className="text-xs text-[var(--danger)]"
        >
          Delete recipe
        </button>
        <button
          type="button"
          onClick={() =>
            start(async () => {
              await updateRecipe(id, { enabled: true });
              router.refresh();
            })
          }
          className="text-xs text-[var(--accent)]"
        >
          Force re-enable
        </button>
      </div>
    </div>
  );
}
