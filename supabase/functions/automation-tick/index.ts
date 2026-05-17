// automation-tick
// Schedule: every 5 minutes via pg_cron.
// Scans for date-driven automation triggers (task_due_soon, task_overdue,
// inventory_low, date_arrives) and inserts notifications into the
// automation_runs table by enqueuing synthetic events on automation_recipes.
//
// This function does NOT execute recipe action handlers itself (those live in
// the Node @zameen/automations package). Instead it writes "pending event"
// rows into automation_runs with status='partial' and triggered_by set; a
// follow-up Node worker (or the next user-driven action) drains them.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
interface Recipe {
  id: string;
  entity_id: string | null;
  trigger_kind: string;
  trigger_config: Record<string, unknown>;
}

Deno.serve(instrument('automation-tick', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const nowIso = new Date().toISOString();

  const queued: Array<{ kind: string; recipeId: string; payload: Record<string, unknown> }> = [];

  // task_due_soon + task_overdue
  const { data: dateRecipes } = await supabase
    .from('automation_recipes')
    .select('id, entity_id, trigger_kind, trigger_config')
    .in('trigger_kind', ['task_due_soon', 'task_overdue', 'date_arrives', 'inventory_low'])
    .eq('enabled', true);

  if (!dateRecipes) return jsonResponse({ ran: 0 });

  for (const r of dateRecipes as Recipe[]) {
    if (r.trigger_kind === 'task_due_soon') {
      const horizonDays = Number((r.trigger_config as { withinDays?: number }).withinDays ?? 1);
      const cutoff = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: tasksDue } = await supabase
        .from('tasks')
        .select('id, title, due_date, entity_id, assignee_id')
        .lte('due_date', cutoff)
        .gte('due_date', nowIso)
        .neq('status', 'done');
      for (const t of tasksDue ?? []) {
        if (r.entity_id && r.entity_id !== t.entity_id) continue;
        queued.push({
          kind: 'task_due_soon',
          recipeId: r.id,
          payload: {
            taskId: t.id,
            taskTitle: t.title,
            dueDate: t.due_date,
            assigneeId: t.assignee_id,
          },
        });
      }
    } else if (r.trigger_kind === 'task_overdue') {
      const minDays = Number((r.trigger_config as { overdueDays?: number }).overdueDays ?? 0);
      const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: tasksOver } = await supabase
        .from('tasks')
        .select('id, title, due_date, entity_id, assignee_id')
        .lt('due_date', cutoff)
        .neq('status', 'done');
      for (const t of tasksOver ?? []) {
        if (r.entity_id && r.entity_id !== t.entity_id) continue;
        const overdueDays = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000);
        queued.push({
          kind: 'task_overdue',
          recipeId: r.id,
          payload: { taskId: t.id, taskTitle: t.title, overdueDays, assigneeId: t.assignee_id },
        });
      }
    } else if (r.trigger_kind === 'inventory_low') {
      const { data: stock } = await supabase
        .from('input_stock')
        .select('input_id, on_hand_qty, reorder_point, entity_id, input_catalog(name)')
        .lte('on_hand_qty', 'reorder_point');
      for (const s of stock ?? []) {
        if (r.entity_id && r.entity_id !== s.entity_id) continue;
        queued.push({
          kind: 'inventory_low',
          recipeId: r.id,
          payload: { inputId: s.input_id, onHand: s.on_hand_qty, reorderPoint: s.reorder_point },
        });
      }
    } else if (r.trigger_kind === 'date_arrives') {
      const targetDate = (r.trigger_config as { date?: string }).date;
      if (targetDate === today) {
        queued.push({
          kind: 'date_arrives',
          recipeId: r.id,
          payload: { date: today },
        });
      }
    }
  }

  if (queued.length > 0) {
    await supabase.from('automation_runs').insert(
      queued.map((q) => ({
        recipe_id: q.recipeId,
        triggered_by: { kind: q.kind, payload: q.payload, queuedAt: nowIso },
        actions_executed: [],
        status: 'partial',
        error_message: 'queued for action handler drain',
      })),
    );
  }

  return jsonResponse({ ran: queued.length, runAt: nowIso });
}));
