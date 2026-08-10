-- AgentSafe standalone foundation.
-- Target: a dedicated Supabase Postgres project (auth.users must exist).
-- Money is stored as integer token base units, never floating point.

create extension if not exists pgcrypto;

create type agentsafe_workspace_role as enum ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');
create type agentsafe_agent_status as enum ('ACTIVE', 'FROZEN');
create type agentsafe_policy_status as enum ('DRAFT', 'ACTIVE', 'RETIRED');
create type agentsafe_intent_status as enum (
  'CREATED',
  'EVALUATING',
  'ALLOWED',
  'DENIED',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'EXPIRED'
);
create type agentsafe_decision_result as enum ('ALLOW', 'DENY', 'REQUIRE_APPROVAL');
create type agentsafe_reservation_status as enum ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED');
create type agentsafe_approval_status as enum ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'USED');
create type agentsafe_environment as enum ('SIMULATED', 'LIVE_DEVNET', 'LIVE_MAINNET');

create table agentsafe_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agentsafe_workspace_members (
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role agentsafe_workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table agentsafe_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  purpose text not null check (char_length(trim(purpose)) between 1 and 4000),
  status agentsafe_agent_status not null default 'ACTIVE',
  frozen_at timestamptz,
  frozen_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check ((status = 'FROZEN') = (frozen_at is not null))
);

create table agentsafe_agent_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  agent_id uuid not null references agentsafe_agents(id) on delete cascade,
  key_prefix text not null check (char_length(key_prefix) between 8 and 32),
  key_hash text not null check (char_length(key_hash) >= 43),
  scopes text[] not null default array['payments:evaluate']::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, key_prefix),
  unique (id, workspace_id, agent_id)
);

create table agentsafe_treasuries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  chain text not null check (chain = 'SOLANA'),
  network text not null check (network in ('DEVNET', 'MAINNET')),
  token text not null check (token = 'USDC'),
  token_mint text not null,
  wallet_address text not null,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, network, token_mint, wallet_address),
  unique (id, workspace_id)
);

create table agentsafe_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  agent_id uuid not null references agentsafe_agents(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, workspace_id, agent_id)
);

create table agentsafe_policy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  policy_id uuid not null references agentsafe_policies(id) on delete cascade,
  agent_id uuid not null references agentsafe_agents(id) on delete cascade,
  version integer not null check (version > 0),
  status agentsafe_policy_status not null,
  chain text not null check (chain = 'SOLANA'),
  network text not null check (network in ('DEVNET', 'MAINNET')),
  token text not null check (token = 'USDC'),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  effective_from timestamptz not null,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (policy_id, version),
  unique (id, workspace_id),
  unique (id, workspace_id, agent_id),
  check (expires_at is null or expires_at > effective_from)
);

create unique index agentsafe_one_active_policy_per_policy
  on agentsafe_policy_versions(policy_id)
  where status = 'ACTIVE';

create table agentsafe_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  agent_id uuid not null references agentsafe_agents(id) on delete cascade,
  external_task_id text not null,
  goal text not null check (char_length(trim(goal)) between 1 and 8000),
  approved_budget_base_units numeric(39, 0) not null check (approved_budget_base_units >= 0),
  spent_base_units numeric(39, 0) not null default 0 check (spent_base_units >= 0),
  reserved_base_units numeric(39, 0) not null default 0 check (reserved_base_units >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, agent_id, external_task_id),
  unique (id, workspace_id),
  unique (id, workspace_id, agent_id),
  check (spent_base_units + reserved_base_units <= approved_budget_base_units)
);

create table agentsafe_payment_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  agent_id uuid not null references agentsafe_agents(id) on delete restrict,
  task_id uuid not null references agentsafe_tasks(id) on delete restrict,
  policy_version_id uuid references agentsafe_policy_versions(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  amount_base_units numeric(39, 0) not null check (amount_base_units > 0),
  token text not null check (token = 'USDC'),
  chain text not null check (chain = 'SOLANA'),
  network text not null check (network in ('DEVNET', 'MAINNET')),
  merchant text,
  recipient text not null,
  service_category text,
  tool text,
  retry_attempt integer not null default 0 check (retry_attempt >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  environment agentsafe_environment not null,
  status agentsafe_intent_status not null default 'CREATED',
  provider_reference text,
  transaction_signature text,
  requested_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, agent_id, idempotency_key),
  unique (id, workspace_id),
  unique (id, workspace_id, policy_version_id),
  unique (id, workspace_id, task_id),
  unique (id, workspace_id, agent_id, task_id)
);

create table agentsafe_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  payment_intent_id uuid not null unique references agentsafe_payment_intents(id) on delete restrict,
  policy_version_id uuid not null references agentsafe_policy_versions(id) on delete restrict,
  result agentsafe_decision_result not null,
  reason_codes text[] not null,
  matched_rule_ids text[] not null,
  risk_signals text[] not null,
  explanation text not null,
  remaining_task_budget_base_units numeric(39, 0) not null check (remaining_task_budget_base_units >= 0),
  remaining_daily_budget_base_units numeric(39, 0) not null check (remaining_daily_budget_base_units >= 0),
  evaluated_at timestamptz not null default now(),
  latency_ms integer not null check (latency_ms >= 0)
);

create table agentsafe_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  payment_intent_id uuid not null unique references agentsafe_payment_intents(id) on delete restrict,
  task_id uuid not null references agentsafe_tasks(id) on delete restrict,
  amount_base_units numeric(39, 0) not null check (amount_base_units > 0),
  status agentsafe_reservation_status not null default 'ACTIVE',
  expires_at timestamptz not null,
  captured_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (not (captured_at is not null and released_at is not null))
);

create table agentsafe_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  payment_intent_id uuid not null unique references agentsafe_payment_intents(id) on delete restrict,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  amount_base_units numeric(39, 0) not null check (amount_base_units > 0),
  token text not null check (token = 'USDC'),
  network text not null check (network in ('DEVNET', 'MAINNET')),
  merchant text,
  recipient text not null,
  reason text not null,
  status agentsafe_approval_status not null default 'PENDING',
  expires_at timestamptz not null,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, request_hash),
  check (expires_at > created_at)
);

create table agentsafe_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references agentsafe_workspaces(id) on delete cascade,
  actor_type text not null check (actor_type in ('USER', 'AGENT', 'SYSTEM')),
  actor_id text not null,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  environment agentsafe_environment not null,
  correlation_id text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index agentsafe_members_user on agentsafe_workspace_members(user_id, workspace_id);
create index agentsafe_agents_workspace on agentsafe_agents(workspace_id, created_at desc);
create index agentsafe_credentials_active on agentsafe_agent_credentials(key_prefix) where revoked_at is null;
create index agentsafe_policy_versions_workspace on agentsafe_policy_versions(workspace_id, policy_id, version desc);
create index agentsafe_tasks_agent on agentsafe_tasks(workspace_id, agent_id, created_at desc);
create index agentsafe_intents_agent_time on agentsafe_payment_intents(workspace_id, agent_id, requested_at desc);
create index agentsafe_intents_status on agentsafe_payment_intents(status, created_at);
create unique index agentsafe_intents_transaction_signature
  on agentsafe_payment_intents(network, transaction_signature)
  where transaction_signature is not null;
create index agentsafe_reservations_active on agentsafe_budget_reservations(task_id, expires_at) where status = 'ACTIVE';
create index agentsafe_approvals_pending on agentsafe_approval_requests(workspace_id, expires_at) where status = 'PENDING';
create index agentsafe_audit_workspace_time on agentsafe_audit_events(workspace_id, created_at desc);
create index agentsafe_audit_resource on agentsafe_audit_events(resource_type, resource_id, created_at);

-- Composite tenant foreign keys prevent a privileged application bug from
-- connecting records that belong to different workspaces.
alter table agentsafe_agent_credentials
  add constraint agentsafe_credentials_agent_tenant_fk
  foreign key (agent_id, workspace_id) references agentsafe_agents(id, workspace_id) on delete cascade;
alter table agentsafe_policies
  add constraint agentsafe_policies_agent_tenant_fk
  foreign key (agent_id, workspace_id) references agentsafe_agents(id, workspace_id) on delete cascade;
alter table agentsafe_policy_versions
  add constraint agentsafe_versions_policy_tenant_fk
  foreign key (policy_id, workspace_id, agent_id)
  references agentsafe_policies(id, workspace_id, agent_id) on delete cascade;
alter table agentsafe_tasks
  add constraint agentsafe_tasks_agent_tenant_fk
  foreign key (agent_id, workspace_id) references agentsafe_agents(id, workspace_id) on delete cascade;
alter table agentsafe_payment_intents
  add constraint agentsafe_intents_agent_tenant_fk
  foreign key (agent_id, workspace_id) references agentsafe_agents(id, workspace_id) on delete restrict;
alter table agentsafe_payment_intents
  add constraint agentsafe_intents_task_tenant_fk
  foreign key (task_id, workspace_id, agent_id)
  references agentsafe_tasks(id, workspace_id, agent_id) on delete restrict;
alter table agentsafe_payment_intents
  add constraint agentsafe_intents_policy_tenant_fk
  foreign key (policy_version_id, workspace_id, agent_id)
  references agentsafe_policy_versions(id, workspace_id, agent_id) on delete restrict;
alter table agentsafe_policy_decisions
  add constraint agentsafe_decisions_intent_tenant_fk
  foreign key (payment_intent_id, workspace_id, policy_version_id)
  references agentsafe_payment_intents(id, workspace_id, policy_version_id) on delete restrict;
alter table agentsafe_policy_decisions
  add constraint agentsafe_decisions_policy_tenant_fk
  foreign key (policy_version_id, workspace_id)
  references agentsafe_policy_versions(id, workspace_id) on delete restrict;
alter table agentsafe_budget_reservations
  add constraint agentsafe_reservations_intent_tenant_fk
  foreign key (payment_intent_id, workspace_id, task_id)
  references agentsafe_payment_intents(id, workspace_id, task_id) on delete restrict;
alter table agentsafe_budget_reservations
  add constraint agentsafe_reservations_task_tenant_fk
  foreign key (task_id, workspace_id)
  references agentsafe_tasks(id, workspace_id) on delete restrict;
alter table agentsafe_approval_requests
  add constraint agentsafe_approvals_intent_tenant_fk
  foreign key (payment_intent_id, workspace_id)
  references agentsafe_payment_intents(id, workspace_id) on delete restrict;

create or replace function agentsafe_reject_immutable_update()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is immutable', tg_table_name using errcode = '55000';
end;
$$;

create trigger agentsafe_policy_versions_immutable
  before update on agentsafe_policy_versions
  for each row execute function agentsafe_reject_immutable_update();
create trigger agentsafe_decisions_immutable
  before update on agentsafe_policy_decisions
  for each row execute function agentsafe_reject_immutable_update();
create trigger agentsafe_audit_events_immutable
  before update on agentsafe_audit_events
  for each row execute function agentsafe_reject_immutable_update();

create or replace function agentsafe_protect_intent_binding()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.workspace_id, new.agent_id, new.task_id, new.policy_version_id,
    new.idempotency_key, new.request_hash, new.amount_base_units, new.token,
    new.chain, new.network, new.merchant, new.recipient, new.service_category,
    new.tool, new.retry_attempt, new.requested_at
  ) is distinct from row(
    old.workspace_id, old.agent_id, old.task_id, old.policy_version_id,
    old.idempotency_key, old.request_hash, old.amount_base_units, old.token,
    old.chain, old.network, old.merchant, old.recipient, old.service_category,
    old.tool, old.retry_attempt, old.requested_at
  ) then
    raise exception 'payment intent binding fields are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger agentsafe_intent_binding_immutable
  before update on agentsafe_payment_intents
  for each row execute function agentsafe_protect_intent_binding();

create or replace function agentsafe_protect_approval_binding()
returns trigger
language plpgsql
as $$
begin
  if row(
    new.workspace_id, new.payment_intent_id, new.request_hash,
    new.amount_base_units, new.token, new.network, new.merchant,
    new.recipient, new.expires_at
  ) is distinct from row(
    old.workspace_id, old.payment_intent_id, old.request_hash,
    old.amount_base_units, old.token, old.network, old.merchant,
    old.recipient, old.expires_at
  ) then
    raise exception 'approval binding fields are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger agentsafe_approval_binding_immutable
  before update on agentsafe_approval_requests
  for each row execute function agentsafe_protect_approval_binding();

create or replace function agentsafe_keep_workspace_owner()
returns trigger
language plpgsql
as $$
declare
  v_workspace_id uuid := old.workspace_id;
  v_removing_owner boolean := false;
begin
  if old.role = 'OWNER' then
    if tg_op = 'DELETE' then
      v_removing_owner := true;
    else
      v_removing_owner := new.role <> 'OWNER';
    end if;
  end if;

  if v_removing_owner and not exists (
       select 1 from agentsafe_workspace_members m
       where m.workspace_id = v_workspace_id
         and m.user_id <> old.user_id
         and m.role = 'OWNER'
     ) then
    raise exception 'workspace must retain at least one owner' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger agentsafe_workspace_last_owner
  before update of role or delete on agentsafe_workspace_members
  for each row execute function agentsafe_keep_workspace_owner();

-- RLS helpers are SECURITY DEFINER to avoid recursive workspace_members RLS.
create or replace function agentsafe_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from agentsafe_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function agentsafe_has_workspace_role(
  p_workspace_id uuid,
  p_roles agentsafe_workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from agentsafe_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function agentsafe_create_workspace(p_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'invalid workspace name' using errcode = '22023';
  end if;

  insert into agentsafe_workspaces (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_workspace_id;

  insert into agentsafe_workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'OWNER');

  return v_workspace_id;
end;
$$;

revoke all on function agentsafe_is_workspace_member(uuid) from public;
revoke all on function agentsafe_has_workspace_role(uuid, agentsafe_workspace_role[]) from public;
revoke all on function agentsafe_create_workspace(text) from public;
grant execute on function agentsafe_is_workspace_member(uuid) to authenticated;
grant execute on function agentsafe_has_workspace_role(uuid, agentsafe_workspace_role[]) to authenticated;
grant execute on function agentsafe_create_workspace(text) to authenticated;

alter table agentsafe_workspaces enable row level security;
alter table agentsafe_workspace_members enable row level security;
alter table agentsafe_agents enable row level security;
alter table agentsafe_agent_credentials enable row level security;
alter table agentsafe_treasuries enable row level security;
alter table agentsafe_policies enable row level security;
alter table agentsafe_policy_versions enable row level security;
alter table agentsafe_tasks enable row level security;
alter table agentsafe_payment_intents enable row level security;
alter table agentsafe_policy_decisions enable row level security;
alter table agentsafe_budget_reservations enable row level security;
alter table agentsafe_approval_requests enable row level security;
alter table agentsafe_audit_events enable row level security;

create policy agentsafe_workspaces_select on agentsafe_workspaces
  for select to authenticated using (agentsafe_is_workspace_member(id));
create policy agentsafe_workspaces_update on agentsafe_workspaces
  for update to authenticated
  using (agentsafe_has_workspace_role(id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));

create policy agentsafe_members_select on agentsafe_workspace_members
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_members_insert on agentsafe_workspace_members
  for insert to authenticated
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));
create policy agentsafe_members_update on agentsafe_workspace_members
  for update to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));
create policy agentsafe_members_delete on agentsafe_workspace_members
  for delete to authenticated
  using (
    agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[])
    and not (user_id = auth.uid() and role = 'OWNER')
  );

create policy agentsafe_agents_select on agentsafe_agents
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_agents_insert on agentsafe_agents
  for insert to authenticated
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));
create policy agentsafe_agents_update on agentsafe_agents
  for update to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'OPERATOR']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'OPERATOR']::agentsafe_workspace_role[]));

create policy agentsafe_credentials_select on agentsafe_agent_credentials
  for select to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));
create policy agentsafe_credentials_manage on agentsafe_agent_credentials
  for all to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));

create policy agentsafe_treasuries_select on agentsafe_treasuries
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_treasuries_manage on agentsafe_treasuries
  for all to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));

create policy agentsafe_policies_select on agentsafe_policies
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_policies_manage on agentsafe_policies
  for all to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));

create policy agentsafe_policy_versions_select on agentsafe_policy_versions
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_policy_versions_insert on agentsafe_policy_versions
  for insert to authenticated
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN']::agentsafe_workspace_role[]));

create policy agentsafe_tasks_select on agentsafe_tasks
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_tasks_manage on agentsafe_tasks
  for all to authenticated
  using (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'OPERATOR']::agentsafe_workspace_role[]))
  with check (agentsafe_has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'OPERATOR']::agentsafe_workspace_role[]));

create policy agentsafe_intents_select on agentsafe_payment_intents
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_decisions_select on agentsafe_policy_decisions
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_reservations_select on agentsafe_budget_reservations
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_approvals_select on agentsafe_approval_requests
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));
create policy agentsafe_audit_select on agentsafe_audit_events
  for select to authenticated using (agentsafe_is_workspace_member(workspace_id));

-- Mutating intents, decisions, reservations, approvals and audit events is a
-- server-only operation. The service role bypasses RLS but remains constrained
-- by database checks/uniqueness and the application transaction boundary.

revoke all on agentsafe_agent_credentials from anon;
revoke all on agentsafe_payment_intents from anon;
revoke all on agentsafe_policy_decisions from anon;
revoke all on agentsafe_budget_reservations from anon;
revoke all on agentsafe_approval_requests from anon;
revoke all on agentsafe_audit_events from anon;

grant select, update on agentsafe_workspaces to authenticated;
grant select, insert, update, delete on agentsafe_workspace_members to authenticated;
grant select, insert, update on agentsafe_agents to authenticated;
grant select, insert, update, delete on agentsafe_agent_credentials to authenticated;
grant select, insert, update, delete on agentsafe_treasuries to authenticated;
grant select, insert, update, delete on agentsafe_policies to authenticated;
grant select, insert on agentsafe_policy_versions to authenticated;
grant select, insert, update, delete on agentsafe_tasks to authenticated;
grant select on agentsafe_payment_intents to authenticated;
grant select on agentsafe_policy_decisions to authenticated;
grant select on agentsafe_budget_reservations to authenticated;
grant select on agentsafe_approval_requests to authenticated;
grant select on agentsafe_audit_events to authenticated;
