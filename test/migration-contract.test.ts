import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/migrations/0001_foundation.sql", import.meta.url),
  "utf8",
).toLowerCase();

const tenantTables = [
  "agentsafe_workspaces",
  "agentsafe_workspace_members",
  "agentsafe_agents",
  "agentsafe_agent_credentials",
  "agentsafe_treasuries",
  "agentsafe_policies",
  "agentsafe_policy_versions",
  "agentsafe_tasks",
  "agentsafe_payment_intents",
  "agentsafe_policy_decisions",
  "agentsafe_budget_reservations",
  "agentsafe_approval_requests",
  "agentsafe_audit_events",
] as const;

test("enables RLS for every tenant table", () => {
  for (const table of tenantTables) {
    assert.match(migration, new RegExp(`alter table ${table} enable row level security;`));
  }
});

test("uses integer numeric base units and contains no key-material columns", () => {
  assert.match(migration, /amount_base_units numeric\(39, 0\)/);
  assert.doesNotMatch(migration, /\b(real|double precision)\b/);
  assert.doesNotMatch(migration, /\b(private_key|secret_key|mnemonic|seed_phrase)\b/);
});

test("binds financial records to tenant-composite foreign keys", () => {
  for (const constraint of [
    "agentsafe_credentials_agent_tenant_fk",
    "agentsafe_versions_policy_tenant_fk",
    "agentsafe_intents_agent_tenant_fk",
    "agentsafe_intents_task_tenant_fk",
    "agentsafe_intents_policy_tenant_fk",
    "agentsafe_decisions_intent_tenant_fk",
    "agentsafe_reservations_task_tenant_fk",
    "agentsafe_approvals_intent_tenant_fk",
  ]) {
    assert.match(migration, new RegExp(`constraint ${constraint}`));
  }
});

test("keeps policy versions, decisions and audit events immutable to updates", () => {
  assert.match(migration, /trigger agentsafe_policy_versions_immutable/);
  assert.match(migration, /trigger agentsafe_decisions_immutable/);
  assert.match(migration, /trigger agentsafe_audit_events_immutable/);
  assert.match(migration, /trigger agentsafe_intent_binding_immutable/);
  assert.match(migration, /trigger agentsafe_approval_binding_immutable/);
});

test("prevents last-owner removal and onchain signature replay", () => {
  assert.match(migration, /trigger agentsafe_workspace_last_owner/);
  assert.match(migration, /unique index agentsafe_intents_transaction_signature/);
  assert.match(migration, /unique \(workspace_id, request_hash\)/);
});
