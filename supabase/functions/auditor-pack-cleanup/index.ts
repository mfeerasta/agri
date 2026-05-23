// auditor-pack-cleanup
//
// Weekly cron. Deletes ZIPs from the auditor-packs bucket whose
// `expires_at` has passed and marks the corresponding rows `expired`.
// Re-issuing access requires regenerating the pack from the admin UI so
// the new signed URL has a fresh 90-day TTL and is also recorded in the
// audit log.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

const BUCKET = 'auditor-packs';

Deno.serve(async () => {
  const sb = getServiceClient();
  const now = new Date().toISOString();
  const { data: expired, error } = await sb
    .from('auditor_export_packs')
    .select('id, storage_path')
    .lt('expires_at', now)
    .eq('status', 'ready');

  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  const removed: string[] = [];
  for (const row of expired ?? []) {
    if (row.storage_path) {
      await sb.storage.from(BUCKET).remove([row.storage_path]);
    }
    await sb
      .from('auditor_export_packs')
      .update({ status: 'expired', download_url: null })
      .eq('id', row.id);
    removed.push(row.id);
  }
  return jsonResponse({ ok: true, removed });
});
