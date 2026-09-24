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

-- The trigger above only fires for accounts created after it exists, so every
-- account that signed up before this table did has no row and therefore no
-- name — which is how a classroom ends up listing "Sin nombre" for everybody.
-- Idempotent, so it costs nothing on a database that is already caught up.
insert into public.profiles (id, first_name, last_name)
select
  u.id,
  nullif(coalesce(u.raw_user_meta_data ->> 'first_name',
                  u.raw_user_meta_data ->> 'given_name', ''), ''),
  nullif(coalesce(u.raw_user_meta_data ->> 'last_name',
                  u.raw_user_meta_data ->> 'family_name', ''), '')
from auth.users u
on conflict (id) do nothing;

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

-- ===========================================================================
-- Classrooms.
--
-- The first feature in Tobot where one account is meant to see another's work.
-- Everything above this line is "owner only", which is what makes a public
-- browser key safe; a classroom deliberately opens a door in that wall, so
-- nearly all of the care lives here rather than in the interface.
--
-- Three decisions shape the rest:
--
--   1. Every membership test goes through a `security definer` function. A
--      policy on `classroom_members` that queries `classroom_members` makes
--      Postgres recurse and every query on the table fails. These functions
--      run past row-level security, which is exactly why they must answer only
--      yes-or-no questions about the caller.
--
--   2. Joining happens through a function, not an insert. A student holding a
--      code cannot read the classroom it names — and exposing classrooms by
--      code would let anyone walk the list.
--
--   3. Nobody writes their own grade. The browser key is public, so a student
--      could otherwise award themselves points with a single request. Scores
--      are written only by the teacher of the room, enforced by a trigger as
--      well as by policy.
-- ===========================================================================

create table if not exists public.classrooms (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  -- Short, typed by hand from a whiteboard, and unique. Case is folded on the
  -- way in so "7KQ2" and "7kq2" are the same room.
  join_code   text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  title        text not null,
  -- What the teacher decided this exercise is worth.
  points       integer not null default 10 check (points >= 0),
  -- The starting algorithm, in the same three columns an algorithm uses, so a
  -- teacher can set their own work rather than only the built-in challenges.
  kind         text not null default 'blocks' check (kind in ('blocks', 'code')),
  body         jsonb not null default '[]'::jsonb,
  source       text,
  -- [{ "answers": ["4", "3"], "expect": ["El área es: 12"] }]
  -- The answers fed to each question in order, and the lines the program
  -- should print. An assignment with no cases cannot be graded automatically.
  cases        jsonb not null default '[]'::jsonb,
  due_at       timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists assignments_classroom_idx
  on public.assignments (classroom_id, created_at desc);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null default 'blocks' check (kind in ('blocks', 'code')),
  body          jsonb not null default '[]'::jsonb,
  source        text,
  -- Written by the teacher's browser after it runs the work. Null until then,
  -- which is how "handed in" is told apart from "marked".
  score         integer,
  passed        integer,
  total         integer,
  checked_at    timestamptz,
  submitted_at  timestamptz not null default now(),
  -- One submission per student per assignment; handing in again replaces it.
  unique (assignment_id, user_id)
);

create index if not exists submissions_assignment_idx
  on public.submissions (assignment_id);

-- ---------------------------------------------------------------------------
-- The yes-or-no questions every policy below is built from.
--
-- `security definer` so they can read the membership table without tripping
-- the policies that are themselves asking these questions. They take no data
-- from the caller beyond an id and return a boolean, so there is nothing here
-- to lever open.
-- ---------------------------------------------------------------------------
create or replace function public.is_member(room uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.classroom_members
    where classroom_id = room and user_id = auth.uid()
  );
$$;

create or replace function public.is_teacher(room uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.classrooms
    where id = room and teacher_id = auth.uid()
  );
$$;

-- Whether the caller and another account are in the same room. This is what
-- lets a ranking show names.
create or replace function public.shares_classroom(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.classroom_members mine
    join public.classroom_members theirs on theirs.classroom_id = mine.classroom_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  ) or exists (
    -- A teacher is not a member of their own room, but is certainly in it.
    select 1 from public.classrooms c
    join public.classroom_members m on m.classroom_id = c.id
    where (c.teacher_id = auth.uid() and m.user_id = other)
       or (c.teacher_id = other and m.user_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies.
-- ---------------------------------------------------------------------------
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- A room is visible to the people in it. Nobody else can even learn it exists,
-- which is also what stops a stranger walking the table looking for codes.
drop policy if exists "read rooms I am in" on public.classrooms;
create policy "read rooms I am in"
  on public.classrooms for select
  using (teacher_id = auth.uid() or public.is_member(id));

drop policy if exists "create my own room" on public.classrooms;
create policy "create my own room"
  on public.classrooms for insert
  with check (teacher_id = auth.uid());

drop policy if exists "the teacher edits the room" on public.classrooms;
create policy "the teacher edits the room"
  on public.classrooms for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "the teacher closes the room" on public.classrooms;
create policy "the teacher closes the room"
  on public.classrooms for delete
  using (teacher_id = auth.uid());

drop policy if exists "see who is in my rooms" on public.classroom_members;
create policy "see who is in my rooms"
  on public.classroom_members for select
  using (public.is_member(classroom_id) or public.is_teacher(classroom_id));

/*
  No insert policy on purpose. Joining goes through `join_classroom` below,
  because a student holding a code cannot read the room the code names, and so
  cannot satisfy any check written against it.
*/

drop policy if exists "leave, or be removed" on public.classroom_members;
create policy "leave, or be removed"
  on public.classroom_members for delete
  using (user_id = auth.uid() or public.is_teacher(classroom_id));

drop policy if exists "read the work set for my rooms" on public.assignments;
create policy "read the work set for my rooms"
  on public.assignments for select
  using (public.is_member(classroom_id) or public.is_teacher(classroom_id));

drop policy if exists "the teacher sets the work" on public.assignments;
create policy "the teacher sets the work"
  on public.assignments for all
  using (public.is_teacher(classroom_id))
  with check (public.is_teacher(classroom_id));

-- A student sees their own work; the teacher sees all of it. Classmates see
-- neither each other's programs nor each other's marks — the ranking is built
-- from scores the teacher can read and publish, not from rows everyone shares.
drop policy if exists "read my work, or my students'" on public.submissions;
create policy "read my work, or my students'"
  on public.submissions for select
  using (
    user_id = auth.uid()
    or public.is_teacher((select classroom_id from public.assignments where id = assignment_id))
  );

drop policy if exists "hand in my own work" on public.submissions;
create policy "hand in my own work"
  on public.submissions for insert
  with check (
    user_id = auth.uid()
    and public.is_member((select classroom_id from public.assignments where id = assignment_id))
  );

drop policy if exists "replace my own work" on public.submissions;
create policy "replace my own work"
  on public.submissions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "the teacher marks the work" on public.submissions;
create policy "the teacher marks the work"
  on public.submissions for update
  using (public.is_teacher((select classroom_id from public.assignments where id = assignment_id)))
  with check (public.is_teacher((select classroom_id from public.assignments where id = assignment_id)));

/*
  The policy above lets a student replace their own submission, which they must
  be able to do — and row-level security cannot express "every column except
  these four". So the columns that hold the grade are guarded here instead.

  Belt as well as braces: without it, "replace my own work" would happily carry
  a score of the student's choosing.
*/
create or replace function public.guard_submission_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  room uuid;
begin
  if tg_op = 'INSERT' then
    if new.score is not null or new.passed is not null
       or new.total is not null or new.checked_at is not null then
      raise exception 'a submission is handed in unmarked';
    end if;
    return new;
  end if;

  if new.score is distinct from old.score
     or new.passed is distinct from old.passed
     or new.total is distinct from old.total
     or new.checked_at is distinct from old.checked_at then
    select classroom_id into room from public.assignments where id = new.assignment_id;
    if not public.is_teacher(room) then
      raise exception 'only the teacher of this classroom may record a score';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_guard_score on public.submissions;
create trigger submissions_guard_score
  before insert or update on public.submissions
  for each row execute function public.guard_submission_score();

-- Classmates can read each other's names, and nothing else: the email lives in
-- `auth.users`, which no policy here reaches.
drop policy if exists "read a classmate's name" on public.profiles;
create policy "read a classmate's name"
  on public.profiles for select
  using (public.shares_classroom(id));

-- ---------------------------------------------------------------------------
-- Joining, which cannot be an insert.
-- ---------------------------------------------------------------------------
create or replace function public.join_classroom(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  room uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in before joining a classroom';
  end if;

  select id into room from public.classrooms
  where join_code = upper(trim(code));

  if room is null then
    -- Deliberately the same answer as a code for a room that exists but is
    -- not yours to see: a different message would turn this into a way of
    -- asking which codes are real.
    raise exception 'no classroom has that code';
  end if;

  insert into public.classroom_members (classroom_id, user_id)
  values (room, auth.uid())
  on conflict do nothing;

  return room;
end;
$$;

revoke all on function public.join_classroom(text) from public;
grant execute on function public.join_classroom(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The ranking, which is an aggregate rather than a pile of work.
--
-- A student can read their own submissions and nobody else's, which is right:
-- the programs their classmates wrote are not theirs to read. But the ranking
-- is supposed to show the whole room, so it cannot be assembled from rows the
-- caller is allowed to see.
--
-- This returns totals and names and nothing else. No program, no per-exercise
-- breakdown, no email — the leaderboard, and only the leaderboard.
-- ---------------------------------------------------------------------------
create or replace function public.classroom_ranking(room uuid)
returns table (user_id uuid, first_name text, last_name text, points integer, handed_in integer)
language sql security definer stable set search_path = public as $$
  select
    m.user_id,
    p.first_name,
    p.last_name,
    coalesce(sum(s.score), 0)::integer as points,
    count(s.id)::integer as handed_in
  from public.classroom_members m
  left join public.profiles p on p.id = m.user_id
  left join public.assignments a on a.classroom_id = m.classroom_id
  left join public.submissions s on s.assignment_id = a.id and s.user_id = m.user_id
  where m.classroom_id = room
    -- Only for someone actually in the room. Without this the function would
    -- happily rank a classroom for a stranger who guessed its id.
    and (public.is_member(room) or public.is_teacher(room))
  group by m.user_id, p.first_name, p.last_name
  order by points desc, p.first_name asc;
$$;

revoke all on function public.classroom_ranking(uuid) from public;
grant execute on function public.classroom_ranking(uuid) to authenticated;
