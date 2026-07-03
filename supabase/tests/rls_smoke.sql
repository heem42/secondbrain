-- RLS smoke test — run against the local stack:
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase/tests/rls_smoke.sql
-- Verifies: signup bootstrap (Inbox), owner isolation, shared read, viewer write-block.
-- Wrapped in a rolled-back transaction so it leaves no residue.

begin;

-- Two fake users. Inserting into auth.users fires handle_new_user() → profile + Inbox.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.dev', '', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.dev',   '', now(), now());

-- Bootstrap check: each user should have exactly one Inbox.
do $$
begin
  assert (select count(*) from lists where owner_id = '11111111-1111-1111-1111-111111111111' and is_inbox) = 1,
    'alice should have an Inbox';
  assert (select count(*) from lists where owner_id = '22222222-2222-2222-2222-222222222222' and is_inbox) = 1,
    'bob should have an Inbox';
  raise notice 'OK: signup bootstrap created Inbox lists';
end $$;

-- Helper to act as a given user under the authenticated role.
create or replace function _act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- ---- Alice creates a work list + task -------------------------------------
select _act_as('11111111-1111-1111-1111-111111111111');
insert into lists (id, owner_id, name)
values ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Work');
insert into tasks (id, list_id, created_by, title)
values ('aaaa2222-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111', 'Ship Phase 1');

-- ---- Bob cannot see Alice's list or task ----------------------------------
select _act_as('22222222-2222-2222-2222-222222222222');
do $$
begin
  assert (select count(*) from lists where id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
    'bob must NOT see alice''s unshared list';
  assert (select count(*) from tasks where id = 'aaaa2222-0000-0000-0000-000000000001') = 0,
    'bob must NOT see alice''s unshared task';
  raise notice 'OK: owner isolation holds';
end $$;

-- ---- Alice shares the list with Bob as viewer -----------------------------
select _act_as('11111111-1111-1111-1111-111111111111');
insert into list_members (list_id, user_id, role)
values ('aaaa1111-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'viewer');

-- ---- Bob can now READ but not WRITE ---------------------------------------
select _act_as('22222222-2222-2222-2222-222222222222');
do $$
declare denied boolean := false;
begin
  assert (select count(*) from tasks where id = 'aaaa2222-0000-0000-0000-000000000001') = 1,
    'viewer bob should now READ the shared task';
  begin
    insert into tasks (list_id, created_by, title)
    values ('aaaa1111-0000-0000-0000-000000000001'::uuid, '22222222-2222-2222-2222-222222222222', 'sneaky');
  exception when others then denied := true;
  end;
  assert denied, 'viewer bob must NOT be able to write to the shared list';
  raise notice 'OK: shared read works, viewer write blocked';
end $$;

do $$ begin raise notice 'ALL RLS SMOKE CHECKS PASSED'; end $$;

rollback;
