-- A separate log for platform-level admin actions.
--
-- `audit_logs` already exists and is workspace-scoped: `workspace_id` is not
-- null, and its policies hang off workspace membership. That is correct for
-- what it records, which is things done inside one creator's business.
--
-- Admin actions have no workspace. Widening `audit_logs` to allow a null one
-- would weaken the tenancy rule on a table whose whole job is to hold it, and
-- would put "the founder read everyone's revenue" in the same list a manager
-- can page through. Two different things, two tables.

create table if not exists admin_audit_logs (
  id         uuid        primary key default gen_random_uuid(),
  actor_id   uuid        references auth.users(id) on delete set null,
  role       text,
  action     text        not null,
  detail     jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on admin_audit_logs (created_at desc);

alter table admin_audit_logs enable row level security;

-- No policies, and no grants: written and read only by the service role,
-- through the admin edge function. Same reasoning as `platform_admins`. An
-- audit trail an admin can edit from a browser is not an audit trail.
revoke all on admin_audit_logs from anon, authenticated;

comment on table admin_audit_logs is
  'Platform-level admin actions, including reads. Workspace-scoped activity belongs in audit_logs.';
