-- AI farm assistant: conversations, messages, and cross-module recommendations.
-- Conversation flows through web, field PWA, ops PWA, and WhatsApp channels.
-- Recommendations are generated daily by the assistant-recommendation-builder
-- edge function (cron 06:00 + 16:00 Asia/Karachi) and surfaced in the inbox.

create table if not exists zameen.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  channel text not null check (channel in ('web','field_pwa','whatsapp','ops_pwa')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  title text,
  context_snapshot jsonb,
  total_tokens int not null default 0,
  total_cost_usd numeric(10,4) not null default 0
);
create index if not exists idx_conv_user on zameen.assistant_conversations(user_id, started_at desc);
create index if not exists idx_conv_entity on zameen.assistant_conversations(entity_id, started_at desc);

create table if not exists zameen.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references zameen.assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  content_ur text,
  voice_url text,
  tool_calls jsonb,
  tool_results jsonb,
  citations jsonb,
  tokens_input int,
  tokens_output int,
  cached_tokens int,
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_conv on zameen.assistant_messages(conversation_id, created_at);

create table if not exists zameen.assistant_recommendations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  generated_at timestamptz not null default now(),
  category text not null check (category in (
    'irrigation','spray','fertilizer','harvest','maintenance','inventory',
    'financial','staffing','weather','compliance'
  )),
  priority text not null check (priority in ('low','medium','high','urgent')),
  field_id uuid references zameen.fields(id),
  title text not null,
  title_ur text,
  rationale text not null,
  recommended_action text not null,
  related_data jsonb,
  acknowledged_at timestamptz,
  acted_on_at timestamptz,
  dismissed_at timestamptz,
  dismiss_reason text
);
create index if not exists idx_rec_entity on zameen.assistant_recommendations(entity_id, generated_at desc);
create index if not exists idx_rec_open on zameen.assistant_recommendations(entity_id, priority)
  where acted_on_at is null and dismissed_at is null;

alter table zameen.assistant_conversations enable row level security;
alter table zameen.assistant_messages enable row level security;
alter table zameen.assistant_recommendations enable row level security;

create policy ac_user on zameen.assistant_conversations
  for all using (user_id = auth.uid());

create policy am_via_conv on zameen.assistant_messages
  for all using (exists (
    select 1 from zameen.assistant_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

create policy ar_entity on zameen.assistant_recommendations
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
