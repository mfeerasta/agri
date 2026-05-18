'use client';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import {
  createWeatherRule,
  deleteWeatherRule,
  installTemplate,
  ruleTemplates,
  toggleWeatherRule,
  type RuleTemplate,
} from './weather-rules-actions';

export interface WeatherRuleRow {
  id: string;
  name: string;
  enabled: boolean;
  conditionKind: string;
  threshold: Record<string, number>;
  actionKind: string;
  actionConfig: Record<string, unknown>;
  lastFiredAt: string | null;
  fireCount: number;
}

export function WeatherRulesClient({ rows }: { rows: WeatherRuleRow[] }) {
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<RuleTemplate | null>(null);

  function install(tpl: RuleTemplate) {
    startTransition(async () => {
      await installTemplate(tpl.key);
    });
  }

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await toggleWeatherRule(id, enabled);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteWeatherRule(id);
    });
  }

  function saveDraft() {
    if (!draft) return;
    startTransition(async () => {
      await createWeatherRule({
        name: draft.name,
        conditionKind: draft.conditionKind,
        threshold: draft.threshold,
        actionKind: draft.actionKind,
        actionConfig: draft.actionConfig,
        enabled: true,
      });
      setDraft(null);
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {ruleTemplates.map((tpl) => (
            <div key={tpl.key} className="border border-[var(--rule)] p-3">
              <div className="font-medium">{tpl.name}</div>
              <div className="text-xs text-[var(--ink)]/60 mt-1">{tpl.blurb}</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => install(tpl)}
                  disabled={pending}
                  className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-[var(--accent-fg)]"
                >
                  Install
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(tpl)}
                  className="px-2 py-1 text-xs rounded border border-[var(--rule)]"
                >
                  Customize
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Customize: {draft.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="smallcaps text-[0.7rem]">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
                className="border-b border-[var(--rule)] bg-transparent py-1 font-mono text-sm"
              />
            </label>
            {Object.keys(draft.threshold).map((k) => (
              <label key={k} className="grid gap-1 text-sm">
                <span className="smallcaps text-[0.7rem]">{k}</span>
                <input
                  type="number"
                  value={draft.threshold[k]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      threshold: { ...draft.threshold, [k]: Number(e.currentTarget.value) },
                    })
                  }
                  className="border-b border-[var(--rule)] bg-transparent py-1 tabular text-sm"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={pending}
                className="px-3 py-1 text-sm rounded bg-[var(--accent)] text-[var(--accent-fg)]"
              >
                Save rule
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-3 py-1 text-sm rounded border border-[var(--rule)]"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">
              No rules yet. Install one of the templates above.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Condition</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Action</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Fires</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Last fired</th>
                  <th className="smallcaps text-center px-3 py-2 text-[0.7rem]">Enabled</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.conditionKind}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.actionKind}</td>
                    <td className="px-3 py-2 text-right tabular">{r.fireCount}</td>
                    <td className="px-3 py-2 tabular text-xs">
                      {r.lastFiredAt ? new Date(r.lastFiredAt).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(r.id, !r.enabled)}
                        disabled={pending}
                        className={`inline-flex w-9 h-5 rounded-full ${r.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                      >
                        <span
                          className={`block w-4 h-4 my-0.5 rounded-full bg-white transition-transform ${r.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={pending}
                        className="text-xs text-[var(--danger)]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
