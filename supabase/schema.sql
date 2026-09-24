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

-- ---------------------------------------------------------------------------
-- Profiles: the display name behind an account.
--
-- Auth stores the email and nothing else, so a name lives here. A row per
-- user, created automatically on sign-up, readable and writable only by its
-- owner: the same ownership rule as algorithms.
create table if not exists public.profiles (
  -- Same id as the auth user, which makes the join trivial and the row
  -- disappear with the account.
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text,
  last_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Creating the row here rather than from the client means a profile always
-- exists, including for accounts created through Google, where the app never
-- sees a sign-up form. `security definer` lets it write past the policies
-- above, which is safe because it only ever inserts the id being created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    -- Password sign-up passes these through `options.data`; Google supplies
    -- `given_name` and `family_name` from the account itself.
    nullif(coalesce(new.raw_user_meta_data ->> 'first_name',
                    new.raw_user_meta_data ->> 'given_name', ''), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'last_name',
                    new.raw_user_meta_data ->> 'family_name', ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Code documents.
--
-- Added after the fact, and additive on purpose: both columns have defaults or
-- allow null, so running this on a database full of block algorithms changes
-- nothing about them. `kind` defaults to 'blocks' precisely so every existing
-- row answers the question correctly without being rewritten.
--
-- The program is text rather than jsonb because it is text. The whole point of
-- this kind is that it is the one thing the app does not parse.
-- ---------------------------------------------------------------------------
alter table public.algorithms
  add column if not exists kind text not null default 'blocks';

alter table public.algorithms
  add column if not exists source text;

-- A third kind would be a bug rather than a feature, and the database is the
-- last place that can still say so.
alter table public.algorithms
  drop constraint if exists algorithms_kind_check;
alter table public.algorithms
  add constraint algorithms_kind_check check (kind in ('blocks', 'code'));

