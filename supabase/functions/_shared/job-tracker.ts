// Wrap an edge-function unit of work with zameen.job_runs telemetry.
// Inserts a 'running' row, then patches to succeeded / failed with duration
// and error message. Catches all errors so observability never breaks the
// underlying function.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export type JobKind = 'pg_cron' | 'edge_function' | 'automation' | 'manual';

export interface JobResult {
  recordsProcessed?: number;
  payload?: Record<string, unknown>;
}

export interface TrackJobRunOptions<T extends JobResult> {
  supabase: SupabaseClient;
  jobName: string;
  jobKind?: JobKind;
  work: () => Promise<T>;
}

export async function trackJobRun<T extends JobResult>(
  opts: TrackJobRunOptions<T>,
): Promise<T> {
  const { supabase, jobName, jobKind = 'edge_function', work } = opts;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let runId: string | null = null;
  try {
    const { data, error } = await supabase
      .from('job_runs')
      .insert({ job_name: jobName, job_kind: jobKind, status: 'running', started_at: startedAt })
      .select('id')
      .single();
    if (!error && data) runId = data.id as string;
  } catch {
    // observability must not break the function
  }

  try {
    const result = await work();
    const completedAt = new Date().toISOString();
    if (runId) {
      try {
        await supabase
          .from('job_runs')
          .update({
            status: 'succeeded',
            completed_at: completedAt,
            duration_ms: Date.now() - t0,
            records_processed: result?.recordsProcessed ?? null,
            payload: result?.payload ?? null,
          })
          .eq('id', runId);
      } catch {
        // ignore
      }
    }
    return result;
  } catch (e) {
    const completedAt = new Date().toISOString();
    const message = e instanceof Error ? e.message : String(e);
    if (runId) {
      try {
        await supabase
          .from('job_runs')
          .update({
            status: 'failed',
            completed_at: completedAt,
            duration_ms: Date.now() - t0,
            error_message: message.slice(0, 4000),
          })
          .eq('id', runId);
      } catch {
        // ignore
      }
    }
    throw e;
  }
}
