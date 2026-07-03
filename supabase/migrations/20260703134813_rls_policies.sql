-- Second Brain — Row Level Security (ARCHITECTURE.md §6)
-- RLS is the authorization boundary. Access to a list = owner OR a row in list_members.
-- tasks/subtasks/task_tags inherit access from their parent list.
-- Membership checks go through SECURITY DEFINER helpers so the list <-> list_members
-- policies don't recurse into each other.

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER: bypass RLS to answer "can I see/write this list?")
-- ---------------------------------------------------------------------------
create or replace function is_list_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lists l
    where l.id = p_list_id and l.owner_id = auth.uid()
  );
$$;

create or replace function can_read_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lists l where l.id = p_list_id and l.owner_id = auth.uid()
  ) or exists (
    select 1 from list_members m
    where m.list_id = p_list_id and m.user_id = auth.uid()
  );
$$;

create or replace function can_write_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lists l where l.id = p_list_id and l.owner_id = auth.uid()
  ) or exists (
    select 1 from list_members m
    where m.list_id = p_list_id and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function can_read_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_read_list((select list_id from tasks where id = p_task_id));
$$;

create or replace function can_write_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_write_list((select list_id from tasks where id = p_task_id));
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on everything
-- ---------------------------------------------------------------------------
alter table profiles     enable row level security;
alter table list_groups  enable row level security;
alter table lists        enable row level security;
alter table list_members enable row level security;
alter table tasks        enable row level security;
alter table subtasks     enable row level security;
alter table tags         enable row level security;
alter table task_tags    enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: readable by any authenticated user (co-member display names);
-- writable only by self.
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_insert on profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- list_groups: fully private to owner
-- ---------------------------------------------------------------------------
create policy list_groups_all on list_groups
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- lists: read if member-or-owner; create your own; edit if owner/editor;
-- delete only by owner.
-- ---------------------------------------------------------------------------
create policy lists_select on lists
  for select to authenticated using (can_read_list(id));
create policy lists_insert on lists
  for insert to authenticated with check (owner_id = auth.uid());
create policy lists_update on lists
  for update to authenticated
  using (can_write_list(id)) with check (can_write_list(id));
create policy lists_delete on lists
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- list_members: members can see the roster; only the list owner manages it.
-- ---------------------------------------------------------------------------
create policy list_members_select on list_members
  for select to authenticated using (can_read_list(list_id));
create policy list_members_insert on list_members
  for insert to authenticated with check (is_list_owner(list_id));
create policy list_members_update on list_members
  for update to authenticated
  using (is_list_owner(list_id)) with check (is_list_owner(list_id));
create policy list_members_delete on list_members
  for delete to authenticated using (is_list_owner(list_id));

-- ---------------------------------------------------------------------------
-- tasks: inherit list access. Read = can_read_list, write = can_write_list.
-- ---------------------------------------------------------------------------
create policy tasks_select on tasks
  for select to authenticated using (can_read_list(list_id));
create policy tasks_insert on tasks
  for insert to authenticated with check (can_write_list(list_id));
create policy tasks_update on tasks
  for update to authenticated
  using (can_write_list(list_id)) with check (can_write_list(list_id));
create policy tasks_delete on tasks
  for delete to authenticated using (can_write_list(list_id));

-- ---------------------------------------------------------------------------
-- subtasks: inherit access from parent task's list.
-- ---------------------------------------------------------------------------
create policy subtasks_select on subtasks
  for select to authenticated using (can_read_task(task_id));
create policy subtasks_insert on subtasks
  for insert to authenticated with check (can_write_task(task_id));
create policy subtasks_update on subtasks
  for update to authenticated
  using (can_write_task(task_id)) with check (can_write_task(task_id));
create policy subtasks_delete on subtasks
  for delete to authenticated using (can_write_task(task_id));

-- ---------------------------------------------------------------------------
-- tags: fully private to owner.
-- ---------------------------------------------------------------------------
create policy tags_all on tags
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- task_tags: link visible if you can read the task; writable if you can write
-- the task AND the tag is your own.
-- ---------------------------------------------------------------------------
create policy task_tags_select on task_tags
  for select to authenticated using (can_read_task(task_id));
create policy task_tags_insert on task_tags
  for insert to authenticated
  with check (
    can_write_task(task_id)
    and exists (select 1 from tags where id = tag_id and owner_id = auth.uid())
  );
create policy task_tags_delete on task_tags
  for delete to authenticated
  using (
    can_write_task(task_id)
    and exists (select 1 from tags where id = tag_id and owner_id = auth.uid())
  );
