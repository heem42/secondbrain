-- Second Brain — initial schema (ARCHITECTURE.md §5)
-- Postgres is the schema of record; PowerSync mirrors a subset into on-device SQLite.
-- Conventions: client-generated UUIDs, updated_at on every mutable table (last-write-wins).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type task_status   as enum ('todo', 'in_progress', 'done');
create type task_priority as enum ('none', 'low', 'medium', 'high');
create type geo_trigger   as enum ('on_enter', 'on_exit');
create type member_role   as enum ('owner', 'editor', 'viewer');

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- list_groups  (folders that group Lists; private to owner)
-- ---------------------------------------------------------------------------
create table list_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  sort_order double precision not null default 0,
  updated_at timestamptz not null default now()
);
create index list_groups_owner_idx on list_groups (owner_id);

-- ---------------------------------------------------------------------------
-- lists  (Swift type: TaskList — TickTick "list"; shareable)
-- ---------------------------------------------------------------------------
create table lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  group_id   uuid references list_groups (id) on delete set null,
  name       text not null,
  color      text,
  is_inbox   boolean not null default false,
  sort_order double precision not null default 0,
  updated_at timestamptz not null default now()
);
create index lists_owner_idx on lists (owner_id);
create index lists_group_idx on lists (group_id);
-- exactly one Inbox per owner
create unique index lists_one_inbox_per_owner on lists (owner_id) where is_inbox;

-- ---------------------------------------------------------------------------
-- list_members  (sharing / collaboration)
-- ---------------------------------------------------------------------------
create table list_members (
  list_id    uuid not null references lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on list_members (user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references lists (id) on delete cascade,
  created_by      uuid references auth.users (id) on delete set null,
  title           text not null,
  notes           text,
  status          task_status   not null default 'todo',
  priority        task_priority not null default 'none',
  due_at          timestamptz,
  remind_at       timestamptz,
  recurrence_rule text,                       -- RFC 5545 RRULE, parsed client-side
  geo_lat         double precision,
  geo_lng         double precision,
  geo_radius      double precision,
  geo_trigger     geo_trigger,
  completed_at    timestamptz,
  sort_order      double precision not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_list_idx   on tasks (list_id);
create index tasks_due_idx    on tasks (due_at);
create index tasks_status_idx on tasks (status);

-- ---------------------------------------------------------------------------
-- subtasks  (checklist items under a task)
-- ---------------------------------------------------------------------------
create table subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  title      text not null,
  is_done    boolean not null default false,
  sort_order double precision not null default 0,
  updated_at timestamptz not null default now()
);
create index subtasks_task_idx on subtasks (task_id);

-- ---------------------------------------------------------------------------
-- tags  (cross-cutting labels; private to owner)
-- ---------------------------------------------------------------------------
create table tags (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text,
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);
create index tags_owner_idx on tags (owner_id);

-- ---------------------------------------------------------------------------
-- task_tags  (many-to-many)
-- ---------------------------------------------------------------------------
create table task_tags (
  task_id uuid not null references tasks (id) on delete cascade,
  tag_id  uuid not null references tags (id) on delete cascade,
  primary key (task_id, tag_id)
);
create index task_tags_tag_idx on task_tags (tag_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-touch (belt-and-suspenders; clients also set it for LWW)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','list_groups','lists','list_members',
    'tasks','subtasks','tags'
  ]
  loop
    execute format(
      'create trigger %1$s_set_updated_at before update on %1$s
         for each row execute function set_updated_at()', t);
  end loop;
end;
$$;
