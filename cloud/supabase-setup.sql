-- Run only in a NEW ALBot project, via its SQL editor. Not an automatic migration.
begin;
create table if not exists public.albot_learning (
  character text primary key check (length(character) between 1 and 80),
  observed_at timestamptz not null,
  snapshot jsonb not null check (octet_length(snapshot::text) <= 20000)
);
alter table public.albot_learning enable row level security;
revoke all on public.albot_learning from anon, authenticated;
grant select, insert, update on public.albot_learning to service_role;
commit;
-- Verification: expected relrowsecurity=true and no anon/authenticated grants.
select relrowsecurity from pg_class where oid='public.albot_learning'::regclass;
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='albot_learning';
