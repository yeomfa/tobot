-- Tobot: schema for saved algorithms.
--
-- Run this once in the Supabase SQL editor (Database > SQL Editor > New query).
--
-- The design is deliberately small: one table, owned rows, and policies that
-- make it impossible for one student to read another's work even if they
-- craft their own requests. The anon key is public, so the database has to be
-- the thing enforcing this, not the client.

create table if not exists public.algorithms (
  -- The id the app already generates, kept as-is so an algorithm keeps its
  -- identity across export and import.
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  -- The statement tree, stored whole. The app is the only thing that reads
  -- its shape, and keeping it as one document means the schema never has to
  -- follow changes to the AST.
  body        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The list is always "mine, newest first", so that is what the index serves.
create index if not exists algorithms_user_updated_idx
  on public.algorithms (user_id, updated_at desc);

alter table public.algorithms enable row level security;

-- Four policies, one per operation. `auth.uid()` is the id of the signed-in
-- user, taken from the request's token rather than from anything the client
-- sends, which is what makes this trustworthy.
drop policy if exists "read own algorithms" on public.algorithms;
create policy "read own algorithms"
  on public.algorithms for select
  using (auth.uid() = user_id);

drop policy if exists "insert own algorithms" on public.algorithms;
create policy "insert own algorithms"
  on public.algorithms for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own algorithms" on public.algorithms;
create policy "update own algorithms"
  on public.algorithms for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own algorithms" on public.algorithms;
create policy "delete own algorithms"
  on public.algorithms for delete
  using (auth.uid() = user_id);

-- Keep `updated_at` honest regardless of what the client sends.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists algorithms_touch_updated_at on public.algorithms;
create trigger algorithms_touch_updated_at
  before update on public.algorithms
  for each row execute function public.touch_updated_at();
