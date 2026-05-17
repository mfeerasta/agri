// Wraps a Deno.serve handler with job_runs telemetry. Use as
//   Deno.serve(instrument('my-fn', async (req) => { ... }))
// The wrapped handler runs through trackJobRun, recording started/completed
// rows in zameen.job_runs. recordsProcessed is parsed from the JSON response
// body when present (fields: generated|nudged|processed|count|recordsProcessed).
import { trackJobRun, type JobKind } from './job-tracker.ts';
import { getServiceClient } from './supabase.ts';

type Handler = (req: Request) => Promise<Response> | Response;

export function instrument(jobName: string, handler: Handler, jobKind: JobKind = 'edge_function'): Handler {
  return async (req: Request): Promise<Response> => {
    let supabase;
    try {
      supabase = getServiceClient();
    } catch {
      // service client unavailable (e.g. local dev without env); run uninstrumented
      return handler(req);
    }
    try {
      const result = await trackJobRun({
        supabase,
        jobName,
        jobKind,
        work: async () => {
          const res = await handler(req);
          let recordsProcessed: number | undefined;
          try {
            const cloned = res.clone();
            const text = await cloned.text();
            if (text) {
              const j = JSON.parse(text) as Record<string, unknown>;
              for (const k of ['recordsProcessed', 'generated', 'nudged', 'processed', 'count', 'inserted']) {
                if (typeof j[k] === 'number') {
                  recordsProcessed = j[k] as number;
                  break;
                }
              }
            }
          } catch {
            // body is not JSON; ignore
          }
          return { recordsProcessed, response: res };
        },
      });
      return result.response;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
  };
}
