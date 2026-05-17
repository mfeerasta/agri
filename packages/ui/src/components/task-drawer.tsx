'use client';
import * as React from 'react';
import { X, Play, Square, MessageCircle, Paperclip, Link2 } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { StatusLabel } from './status-label.js';
import { PriorityBadge, type Priority } from './priority-badge.js';
import { PersonPill, type Person } from './person-pill.js';

export interface TaskDrawerTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: Priority | string | null;
  labels: string[];
  dueDate?: string | null;
  assignees: Person[];
  subtasks: Array<{ id: string; title: string; status: string }>;
  predecessors: Array<{ id: string; title: string }>;
  successors: Array<{ id: string; title: string }>;
  timeEntries: Array<{ id: string; startedAt: string; endedAt?: string | null; durationMinutes?: number | null; workerName?: string }>;
  comments: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
    parentCommentId?: string | null;
  }>;
  activity: Array<{ id: string; verb: string; actorName?: string; occurredAt: string }>;
  attachments: Array<{ url: string; name?: string }>;
}

export interface TaskDrawerProps {
  task: TaskDrawerTask | null;
  open: boolean;
  onClose: () => void;
  onTitleChange?: (title: string) => Promise<void> | void;
  onStatusChange?: (status: string) => Promise<void> | void;
  onDescriptionChange?: (description: string) => Promise<void> | void;
  onAddSubtask?: (title: string) => Promise<void> | void;
  onAddComment?: (body: string, parentCommentId?: string) => Promise<void> | void;
  onStartTimer?: () => Promise<void> | void;
  onStopTimer?: (entryId: string) => Promise<void> | void;
  statusOptions?: string[];
  className?: string;
}

const STATUS_CYCLE = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];

export function TaskDrawer({
  task,
  open,
  onClose,
  onTitleChange,
  onStatusChange,
  onDescriptionChange,
  onAddSubtask,
  onAddComment,
  onStartTimer,
  onStopTimer,
  statusOptions,
  className,
}: TaskDrawerProps) {
  const [titleDraft, setTitleDraft] = React.useState('');
  const [descDraft, setDescDraft] = React.useState('');
  const [subtaskDraft, setSubtaskDraft] = React.useState('');
  const [commentDraft, setCommentDraft] = React.useState('');
  const [replyTo, setReplyTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTitleDraft(task?.title ?? '');
    setDescDraft(task?.description ?? '');
    setReplyTo(null);
  }, [task?.id]);

  if (!open || !task) return null;

  const running = task.timeEntries.find((e) => !e.endedAt);
  const totalMin = task.timeEntries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const opts = statusOptions ?? STATUS_CYCLE;

  function cycleStatus() {
    if (!onStatusChange || !task) return;
    const idx = opts.indexOf(task.status);
    const next = opts[(idx + 1) % opts.length] ?? opts[0]!;
    void onStatusChange(next);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-2)] shadow-2xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <span className="smallcaps text-xs text-[var(--fg-muted)]">Task</span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (onTitleChange && titleDraft.trim() && titleDraft !== task.title) void onTitleChange(titleDraft.trim());
            }}
            className="w-full bg-transparent font-display text-2xl text-[var(--fg)] outline-none focus:border-b focus:border-[var(--accent)]"
          />

          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel status={task.status} onClick={onStatusChange ? cycleStatus : undefined} />
            {task.priority ? <PriorityBadge priority={task.priority as Priority} /> : null}
            {task.dueDate ? (
              <span className="tabular text-xs text-[var(--fg-muted)]">Due {task.dueDate}</span>
            ) : null}
            {task.labels.map((l) => (
              <span key={l} className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem] text-[var(--fg-muted)]">{l}</span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="smallcaps text-[0.65rem]">Assignees</span>
            {task.assignees.length === 0 ? <span className="text-xs text-[var(--fg-subtle)]">Unassigned</span> : null}
            {task.assignees.map((p) => <PersonPill key={p.id} person={p} />)}
          </div>

          <section>
            <h4 className="smallcaps mb-2 text-[0.65rem]">Description</h4>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={() => {
                if (onDescriptionChange && descDraft !== (task.description ?? '')) void onDescriptionChange(descDraft);
              }}
              rows={4}
              placeholder="Add a description"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)]"
            />
          </section>

          <section>
            <h4 className="smallcaps mb-2 text-[0.65rem]">Subtasks ({task.subtasks.length})</h4>
            <ul className="space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1.5 text-xs">
                  <span className="truncate">{s.title}</span>
                  <StatusLabel status={s.status} />
                </li>
              ))}
            </ul>
            {onAddSubtask ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (subtaskDraft.trim()) {
                    void onAddSubtask(subtaskDraft.trim());
                    setSubtaskDraft('');
                  }
                }}
                className="mt-2 flex gap-1"
              >
                <input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder="Add subtask"
                  className="h-8 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                />
                <button type="submit" className="h-8 rounded bg-[var(--accent)] px-3 text-xs font-medium text-[var(--bg)]">Add</button>
              </form>
            ) : null}
          </section>

          {task.predecessors.length + task.successors.length > 0 ? (
            <section>
              <h4 className="smallcaps mb-2 text-[0.65rem]">Dependencies</h4>
              <div className="space-y-1 text-xs">
                {task.predecessors.map((p) => (
                  <div key={`pre-${p.id}`} className="flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Link2 size={10} /> Blocked by <span className="text-[var(--fg)]">{p.title}</span>
                  </div>
                ))}
                {task.successors.map((s) => (
                  <div key={`suc-${s.id}`} className="flex items-center gap-1.5 text-[var(--fg-muted)]">
                    <Link2 size={10} /> Blocks <span className="text-[var(--fg)]">{s.title}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="smallcaps text-[0.65rem]">Time tracking</h4>
              <span className="tabular text-xs text-[var(--fg-muted)]">
                {Math.floor(totalMin / 60)}h {totalMin % 60}m total
              </span>
            </div>
            <div className="mb-2">
              {running ? (
                <button
                  type="button"
                  onClick={() => onStopTimer?.(running.id)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-[var(--bg)]"
                >
                  <Square size={12} /> Stop timer
                </button>
              ) : onStartTimer ? (
                <button
                  type="button"
                  onClick={() => onStartTimer()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--bg)]"
                >
                  <Play size={12} /> Start timer
                </button>
              ) : null}
            </div>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {task.timeEntries.map((e) => (
                <li key={e.id} className="flex justify-between text-[0.7rem] text-[var(--fg-muted)]">
                  <span>{e.workerName ?? '—'} · {new Date(e.startedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="tabular">{e.durationMinutes != null ? `${e.durationMinutes}m` : 'running…'}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="smallcaps mb-2 flex items-center gap-1 text-[0.65rem]">
              <MessageCircle size={11} /> Comments ({task.comments.length})
            </h4>
            <ul className="space-y-2">
              {task.comments.map((c) => (
                <li key={c.id} className={cn('rounded border border-[var(--border)] bg-[var(--surface)] p-2', c.parentCommentId ? 'ml-4' : '')}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-[var(--fg)]">{c.authorName}</span>
                    <span className="tabular text-[0.65rem] text-[var(--fg-subtle)]">{new Date(c.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-xs text-[var(--fg)]">{c.body}</div>
                  {onAddComment ? (
                    <button
                      type="button"
                      onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                      className="mt-1 text-[0.65rem] text-[var(--fg-subtle)] hover:text-[var(--accent)]"
                    >
                      {replyTo === c.id ? 'Cancel' : 'Reply'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {onAddComment ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentDraft.trim()) {
                    void onAddComment(commentDraft.trim(), replyTo ?? undefined);
                    setCommentDraft('');
                    setReplyTo(null);
                  }
                }}
                className="mt-2 space-y-1"
              >
                {replyTo ? <div className="text-[0.65rem] text-[var(--fg-subtle)]">Replying to comment</div> : null}
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={2}
                  placeholder="Add a comment, @mention with @name"
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs"
                />
                <button type="submit" className="h-7 rounded bg-[var(--accent)] px-3 text-xs font-medium text-[var(--bg)]">Post</button>
              </form>
            ) : null}
          </section>

          {task.attachments.length > 0 ? (
            <section>
              <h4 className="smallcaps mb-2 flex items-center gap-1 text-[0.65rem]"><Paperclip size={11} /> Attachments</h4>
              <ul className="space-y-1 text-xs">
                {task.attachments.map((a, i) => (
                  <li key={i}>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                      {a.name ?? a.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="smallcaps mb-2 text-[0.65rem]">Activity</h4>
            <ul className="space-y-1 text-[0.7rem] text-[var(--fg-muted)]">
              {task.activity.slice(0, 20).map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.actorName ?? 'System'} {a.verb}</span>
                  <span className="tabular text-[var(--fg-subtle)]">{new Date(a.occurredAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}
