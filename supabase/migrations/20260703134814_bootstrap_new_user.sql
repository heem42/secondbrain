-- Second Brain — new-user bootstrap
-- On signup, every user gets a profile row and their private Inbox list
-- (the is_inbox list that the "Inbox" smart list reads from — ARCHITECTURE.md §5).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.lists (owner_id, name, is_inbox, sort_order)
  values (new.id, 'Inbox', true, 0)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
