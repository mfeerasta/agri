'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ACTION_KINDS, type ActionKind, type Condition, type ConditionOp, type TriggerKind } from '@zameen/automations';
import { createRecipe } from './actions';

const OPS: ConditionOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'exists'];

export interface RecipeBuilderProps {
  triggerKinds: TriggerKind[];
  initial?: {
    name?: string;
    triggerKind?: TriggerKind;
    conditions?: Condition[];
    actions?: Array<{ kind: ActionKind; config: Record<string, unknown> }>;
  };
}

export function RecipeBuilder({ triggerKinds, initial }: RecipeBuilderProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? '');
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(initial?.triggerKind ?? triggerKinds[0]!);
  const [conditions, setConditions] = useState<Condition[]>(initial?.conditions ?? []);
  const [actions, setActions] = useState<Array<{ kind: ActionKind; config: Record<string, unknown> }>>(
    initial?.actions ?? [{ kind: 'notify_user', config: {} }],
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createRecipe({
        entityId: null,
        name,
        triggerKind,
        triggerConfig: {},
        conditions,
        actions,
        enabled: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/admin/automations');
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="smallcaps text-[0.65rem] block mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="When X happens, do Y"
          className="w-full px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--rule)] text-sm"
        />
      </div>

      <div>
        <label className="smallcaps text-[0.65rem] block mb-2">Trigger</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {triggerKinds.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTriggerKind(t)}
              className={`text-left px-3 py-2 rounded-md border text-xs ${
                triggerKind === t
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--rule)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="smallcaps text-[0.65rem]">Conditions (ANDed)</label>
          <button
            type="button"
            onClick={() => setConditions([...conditions, { field: '', op: 'eq', value: '' }])}
            className="text-xs text-[var(--accent)]"
          >
            + add condition
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {conditions.map((c, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={c.field}
                onChange={(e) => {
                  const next = [...conditions];
                  next[idx] = { ...c, field: e.target.value };
                  setConditions(next);
                }}
                placeholder="field.path"
                className="flex-1 px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)] text-xs"
              />
              <select
                value={c.op}
                onChange={(e) => {
                  const next = [...conditions];
                  next[idx] = { ...c, op: e.target.value as ConditionOp };
                  setConditions(next);
                }}
                className="px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)] text-xs"
              >
                {OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                value={typeof c.value === 'string' ? c.value : JSON.stringify(c.value ?? '')}
                onChange={(e) => {
                  const next = [...conditions];
                  let v: unknown = e.target.value;
                  if (!isNaN(Number(v)) && v !== '') v = Number(v);
                  next[idx] = { ...c, value: v };
                  setConditions(next);
                }}
                placeholder="value"
                className="flex-1 px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)] text-xs"
              />
              <button
                type="button"
                onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                className="text-xs text-[var(--danger)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="smallcaps text-[0.65rem]">Actions</label>
          <button
            type="button"
            onClick={() => setActions([...actions, { kind: 'notify_user', config: {} }])}
            className="text-xs text-[var(--accent)]"
          >
            + add action
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {actions.map((a, idx) => (
            <div key={idx} className="border border-[var(--rule)] rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={a.kind}
                  onChange={(e) => {
                    const next = [...actions];
                    next[idx] = { kind: e.target.value as ActionKind, config: {} };
                    setActions(next);
                  }}
                  className="px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)] text-xs"
                >
                  {ACTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                  className="text-xs text-[var(--danger)] ml-auto"
                >
                  remove
                </button>
              </div>
              <textarea
                value={JSON.stringify(a.config, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    const next = [...actions];
                    next[idx] = { ...a, config: parsed };
                    setActions(next);
                  } catch {
                    // ignore invalid JSON keystrokes
                  }
                }}
                rows={4}
                className="font-mono text-xs px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--rule)]"
              />
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="text-xs text-[var(--danger)]">{error}</div> : null}

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={pending || !name}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save recipe'}
        </button>
      </div>
    </div>
  );
}
