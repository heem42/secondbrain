-- Second Brain — denormalize list_id onto subtasks and task_tags.
--
-- Why: PowerSync sync rules bucket rows by list_id, but a data query can only
-- filter on a column that physically exists on the row. subtasks (task_id only)
-- and task_tags (task_id, tag_id) have no list_id, so they can't join a
-- per-list bucket. We copy list_id down from the parent task and keep it in sync
-- with a trigger. It is derived data — never set it by hand on the client.

alter table subtasks  add column list_id uuid references lists (id) on delete cascade;
alter table task_tags add column list_id uuid references lists (id) on delete cascade;

-- Backfill (no rows yet in a fresh DB, but correct if run against existing data).
update subtasks  s set list_id = t.list_id from tasks t where t.id = s.task_id;
update task_tags x set list_id = t.list_id from tasks t where t.id = x.task_id;

alter table subtasks  alter column list_id set not null;
alter table task_tags alter column list_id set not null;

create index subtasks_list_idx  on subtasks  (list_id);
create index task_tags_list_idx on task_tags (list_id);

-- Keep list_id in lockstep with the parent task's list_id.
create or replace function sync_child_list_id()
returns trigger
language plpgsql
as $$
begin
  select t.list_id into new.list_id from tasks t where t.id = new.task_id;
  return new;
end;
$$;

create trigger subtasks_sync_list_id
  before insert or update of task_id on subtasks
  for each row execute function sync_child_list_id();

create trigger task_tags_sync_list_id
  before insert or update of task_id on task_tags
  for each row execute function sync_child_list_id();

-- If a task moves to another list, cascade list_id to its children.
create or replace function propagate_task_list_id()
returns trigger
language plpgsql
as $$
begin
  if new.list_id is distinct from old.list_id then
    update subtasks  set list_id = new.list_id where task_id = new.id;
    update task_tags set list_id = new.list_id where task_id = new.id;
  end if;
  return new;
end;
$$;

create trigger tasks_propagate_list_id
  after update of list_id on tasks
  for each row execute function propagate_task_list_id();
