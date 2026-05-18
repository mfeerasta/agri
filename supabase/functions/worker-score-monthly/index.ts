// worker-score-monthly
// Schedule: pg_cron on the 2nd of each month at 03:00 PKT (22:00 UTC prev day).
// Walks every active entity, computes composite scores for the previous
// calendar month, persists them, and applies each active bonus rule. Bonus
// amounts land on the score row (bonus_amount_pkr) for inclusion in the next
// payroll run.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface ScoreInputs {
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  tasksCompleted: number;
  tasksLate: number;
  pieceRateUnits: number;
  pieceRateTotalPkr: number;
  dieselAnomaliesAssociated: number;
  totalDays: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function compositeScore(x: ScoreInputs): number {
  const attendanceRate = clamp(x.daysPresent / Math.max(1, x.totalDays), 0, 1);
  const raw =
    attendanceRate * 30 +
    Math.min(x.tasksCompleted / 20, 1) * 25 +
    Math.min(x.pieceRateUnits / 500, 1) * 25 +
    Math.min(x.pieceRateTotalPkr / 50000, 1) * 15 +
    -x.tasksLate * 2 +
    -x.daysLate * 1 +
    -x.dieselAnomaliesAssociated * 5;
  return Number(clamp(raw, 0, 100).toFixed(4));
}

function previousMonthBoundsPkt(reference: Date): { start: string; end: string } {
  const pkt = new Date(reference.getTime() + 5 * 60 * 60 * 1000);
  const y = pkt.getUTCFullYear();
  const m = pkt.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86_400_000,
  ) + 1;
}

function isLateCheckIn(checkIn: string | null): boolean {
  if (!checkIn) return false;
  const d = new Date(checkIn);
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes > 7 * 60 + 30;
}

Deno.serve(instrument('worker-score-monthly', async () => {
  const supabase = getServiceClient();
  const { start, end } = previousMonthBoundsPkt(new Date());
  const totalDays = daysBetween(start, end);

  const { data: entities, error: eErr } = await supabase.from('entities').select('id, is_active').eq('is_active', true);
  if (eErr) return jsonResponse({ error: eErr.message }, 500);

  let processed = 0;
  let bonusesAwarded = 0;

  for (const ent of entities ?? []) {
    const entityId = ent.id as string;

    const { data: roster } = await supabase
      .from('workers')
      .select('id, full_name, monthly_salary_pkr, daily_wage_pkr')
      .eq('entity_id', entityId)
      .eq('is_active', true);

    const computed: Array<{ workerId: string; score: number; row: ScoreInputs }> = [];

    for (const w of roster ?? []) {
      const workerId = w.id as string;

      const { data: attendance } = await supabase
        .from('attendance_records')
        .select('status, check_in_at')
        .eq('worker_id', workerId)
        .gte('work_date', start)
        .lte('work_date', end);
      const present = (attendance ?? []).filter((a) => a.status === 'present' || a.status === 'half_day');
      const daysPresent = present.reduce((acc: number, a) => acc + (a.status === 'half_day' ? 0.5 : 1), 0);
      const daysAbsent = (attendance ?? []).filter((a) => a.status === 'absent').length;
      const daysLate = present.filter((a) => isLateCheckIn(a.check_in_at as string | null)).length;

      const { data: completions } = await supabase
        .from('task_completions')
        .select('id, task_id, completed_at')
        .eq('worker_id', workerId)
        .gte('completed_at', start)
        .lte('completed_at', end + 'T23:59:59Z');
      const tasksCompleted = (completions ?? []).length;

      const { data: assignments } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('worker_id', workerId);
      const assignedIds = (assignments ?? []).map((a) => a.task_id as string);
      let tasksLate = 0;
      if (assignedIds.length > 0) {
        const { data: taskRows } = await supabase
          .from('tasks')
          .select('id, due_date, scheduled_for, status')
          .in('id', assignedIds);
        const compMap = new Map<string, string>();
        for (const c of completions ?? []) compMap.set(c.task_id as string, c.completed_at as string);
        for (const t of taskRows ?? []) {
          const due = t.due_date as string | null;
          if (!due) continue;
          const anchor = (t.scheduled_for as string | null) ?? due;
          if (!(anchor >= start && anchor <= end)) continue;
          const done = compMap.get(t.id as string);
          const dueMs = new Date(due + 'T23:59:59Z').getTime();
          if (done && new Date(done).getTime() > dueMs) tasksLate += 1;
          if (!done && t.status !== 'open' && Date.now() > dueMs) tasksLate += 1;
        }
      }

      const { data: pieces } = await supabase
        .from('piece_rate_logs')
        .select('quantity, total_pkr')
        .eq('worker_id', workerId)
        .gte('work_date', start)
        .lte('work_date', end);
      const pieceRateUnits = (pieces ?? []).reduce((s: number, p) => s + Number(p.quantity), 0);
      const pieceRateTotalPkr = (pieces ?? []).reduce((s: number, p) => s + Number(p.total_pkr), 0);

      const { data: dieselLogs } = await supabase
        .from('diesel_daily_logs')
        .select('id')
        .eq('operator_id', workerId)
        .gte('log_date', start)
        .lte('log_date', end);
      const logIds = (dieselLogs ?? []).map((l) => l.id as string);
      let dieselAnomaliesAssociated = 0;
      if (logIds.length > 0) {
        const { data: anomalies } = await supabase
          .from('diesel_anomalies')
          .select('id')
          .in('diesel_daily_log_id', logIds);
        dieselAnomaliesAssociated = (anomalies ?? []).length;
      }

      const row: ScoreInputs = {
        daysPresent,
        daysAbsent,
        daysLate,
        tasksCompleted,
        tasksLate,
        pieceRateUnits,
        pieceRateTotalPkr,
        dieselAnomaliesAssociated,
        totalDays,
      };
      const score = compositeScore(row);
      computed.push({ workerId, score, row });
    }

    // Rank + persist
    computed.sort((a, b) => b.score - a.score);
    await supabase
      .from('worker_score_periods')
      .delete()
      .eq('entity_id', entityId)
      .eq('period_start', start)
      .eq('period_end', end);

    let rank = 0;
    for (const c of computed) {
      rank += 1;
      await supabase.from('worker_score_periods').insert({
        entity_id: entityId,
        worker_id: c.workerId,
        period_start: start,
        period_end: end,
        days_present: Math.round(c.row.daysPresent),
        days_absent: c.row.daysAbsent,
        days_late: c.row.daysLate,
        tasks_completed: c.row.tasksCompleted,
        tasks_late: c.row.tasksLate,
        piece_rate_units: c.row.pieceRateUnits.toFixed(4),
        piece_rate_total_pkr: c.row.pieceRateTotalPkr.toFixed(2),
        diesel_anomalies_associated: c.row.dieselAnomaliesAssociated,
        composite_score: c.score.toFixed(4),
        rank_in_period: rank,
        bonus_eligible: false,
        bonus_amount_pkr: 0,
      });
      processed += 1;
    }

    // Apply active bonus rules
    const { data: rules } = await supabase
      .from('bonus_rules')
      .select('id, name, formula, min_score, amount_kind, amount_value, top_n, period_kind')
      .eq('entity_id', entityId)
      .eq('active', true)
      .eq('period_kind', 'monthly');

    for (const rule of rules ?? []) {
      const formula = (rule.formula ?? {}) as Record<string, number | undefined>;
      const { data: periodRows } = await supabase
        .from('worker_score_periods')
        .select('id, worker_id, composite_score, days_present, days_late, tasks_late, tasks_completed, piece_rate_units, piece_rate_total_pkr, diesel_anomalies_associated')
        .eq('entity_id', entityId)
        .eq('period_start', start)
        .eq('period_end', end)
        .order('composite_score', { ascending: false });

      const eligible = (periodRows ?? []).filter((r) => {
        if (Number(r.composite_score) < Number(rule.min_score)) return false;
        if (formula.minDaysPresent != null && (r.days_present as number) < formula.minDaysPresent) return false;
        if (formula.maxDaysLate != null && (r.days_late as number) > formula.maxDaysLate) return false;
        if (formula.maxTasksLate != null && (r.tasks_late as number) > formula.maxTasksLate) return false;
        if (formula.maxDieselAnomalies != null && (r.diesel_anomalies_associated as number) > formula.maxDieselAnomalies) return false;
        if (formula.minTasksCompleted != null && (r.tasks_completed as number) < formula.minTasksCompleted) return false;
        if (formula.minPieceRateUnits != null && Number(r.piece_rate_units) < formula.minPieceRateUnits) return false;
        return true;
      });

      const winners = rule.amount_kind === 'top_n' && rule.top_n ? eligible.slice(0, rule.top_n as number) : eligible;

      for (const w of winners) {
        let bonusPkr = 0;
        const amt = Number(rule.amount_value);
        if (rule.amount_kind === 'flat' || rule.amount_kind === 'top_n') {
          bonusPkr = amt;
        } else if (rule.amount_kind === 'percent_of_base') {
          const { data: wkr } = await supabase
            .from('workers')
            .select('monthly_salary_pkr, daily_wage_pkr')
            .eq('id', w.worker_id as string)
            .single();
          const base = Number(wkr?.monthly_salary_pkr ?? wkr?.daily_wage_pkr ?? 0);
          bonusPkr = Number((base * (amt / 100)).toFixed(2));
        } else if (rule.amount_kind === 'percent_of_piece_rate') {
          bonusPkr = Number((Number(w.piece_rate_total_pkr) * (amt / 100)).toFixed(2));
        }
        await supabase
          .from('worker_score_periods')
          .update({ bonus_eligible: true, bonus_amount_pkr: bonusPkr })
          .eq('id', w.id as string);
        bonusesAwarded += 1;
      }
    }
  }

  return jsonResponse({ processed, bonusesAwarded, periodStart: start, periodEnd: end });
}));
