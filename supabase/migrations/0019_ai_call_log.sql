-- AI call log. One row per Claude / OpenAI invocation. Used for cost tracking,
-- abuse detection, and per-user usage caps. PII is scrubbed before write by
-- summarizePrompt() in @zameen/shared/ai/citations.

create table if not exists zameen.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  user_id uuid,
  entity_id uuid,
  prompt_summary text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  model text,
  cached boolean not null default false,
  error_message text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_ai_call_user_time on zameen.ai_call_log(user_id, occurred_at desc);
create index if not exists idx_ai_call_kind_time on zameen.ai_call_log(kind, occurred_at desc);

alter table zameen.ai_call_log enable row level security;

create policy "ai_call_log_service_write" on zameen.ai_call_log
  for insert
  with check (auth.role() = 'service_role');

create policy "ai_call_log_owner_read" on zameen.ai_call_log
  for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

-- Purge expired advisor cache rows hourly. Uses pg_cron (already enabled
-- in 0004). Also trims ai_call_log older than 180 days.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-ai-advisor-cache',
      '17 * * * *',
      $cmd$ delete from zameen.ai_advisor_cache where expires_at < now() $cmd$
    );
    perform cron.schedule(
      'trim-ai-call-log',
      '23 3 * * *',
      $cmd$ delete from zameen.ai_call_log where occurred_at < now() - interval '180 days' $cmd$
    );
  end if;
end $$;
