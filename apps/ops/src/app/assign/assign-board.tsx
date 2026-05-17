'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, BigButton } from '@zameen/ui';
import { assignWorkers } from './actions';

interface TaskRow {
  id: string;
  title: string;
  taskKind: string;
  scheduledFor: string | null;
  estimatedHours: number | null;
}

interface WorkerRow {
  id: string;
  code: string;
  fullName: string;
}

interface Group {
  type: string;
  workers: WorkerRow[];
}

export function AssignBoard({ tasks, workersByType }: { tasks: TaskRow[]; workersByType: Group[] }) {
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(tasks[0]?.id ?? null);
  const [selectedWorkers, setSelectedWorkers] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  function toggleWorker(id: string) {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function commit() {
    if (!selectedTaskId || selectedWorkers.size === 0) return;
    setBusy(true);
    setMsg(null);
    const r = await assignWorkers({ taskId: selectedTaskId, workerIds: Array.from(selectedWorkers) });
    setBusy(false);
    if (r.ok) {
      setMsg(`Assigned ${selectedWorkers.size} worker(s)`);
      setSelectedWorkers(new Set());
      // simple refresh
      setTimeout(() => window.location.reload(), 600);
    } else {
      setMsg(r.error);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unassigned tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((t) => {
            const active = t.id === selectedTaskId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTaskId(t.id)}
                className={`w-full rounded-sm border p-3 text-left transition ${
                  active
                    ? 'border-[var(--zameen-700)] bg-[var(--paper-2)]'
                    : 'border-[var(--rule)] hover:bg-[var(--paper-2)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-[var(--ink)]/60">
                      {t.taskKind} · {t.scheduledFor ?? '—'} · {t.estimatedHours ?? '—'} hrs
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workersByType.map((g) => (
            <div key={g.type}>
              <div className="smallcaps mb-2 text-[0.7rem] text-[var(--ink)]/70">{g.type.replace('_', ' ')}</div>
              <div className="grid grid-cols-2 gap-2">
                {g.workers.map((w) => {
                  const on = selectedWorkers.has(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => toggleWorker(w.id)}
                      className={`rounded-sm border p-2 text-left text-sm transition ${
                        on
                          ? 'border-[var(--zameen-700)] bg-[var(--zameen-700)] text-[var(--paper)]'
                          : 'border-[var(--rule)] hover:bg-[var(--paper-2)]'
                      }`}
                    >
                      <div className="font-medium">{w.fullName}</div>
                      <div className="text-xs opacity-70">{w.code}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="pt-2">
            <BigButton
              label={busy ? 'Saving…' : `Assign ${selectedWorkers.size} to task`}
              onClick={commit}
              disabled={busy || !selectedTaskId || selectedWorkers.size === 0}
            />
            {msg ? <p className="mt-2 text-sm text-[var(--ink)]/70">{msg}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
