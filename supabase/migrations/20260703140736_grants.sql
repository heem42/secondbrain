-- Second Brain — table privileges for the authenticated role.
--
-- Grants control *table* access; RLS controls *which rows*. Both must pass.
-- Our RLS policies are all `to authenticated`, so anon gets nothing. We grant
-- the CRUD verbs to authenticated and let the RLS policies do the real gating.
-- Default privileges cover any tables added by future migrations.

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

-- Future tables created by postgres in public inherit the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
