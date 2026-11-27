create table if not exists public.task_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.task_workspaces enable row level security;

-- Anonymous Supabase Auth sessions receive the authenticated database role.
-- Each browser session can only read or change its own workspace row.
create policy "Users can read their own task workspace"
  on public.task_workspaces for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own task workspace"
  on public.task_workspaces for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own task workspace"
  on public.task_workspaces for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.task_workspaces to authenticated;
