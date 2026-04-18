-- BeScore app baseline schema (idempotent)
-- Apply this in each Supabase project (dev/staging/prod).

create extension if not exists pgcrypto;

-- Profiles mirror auth.users and are used by app relationships.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  game_type text,
  status text default 'draft',
  settings jsonb,
  created_at timestamptz default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  team_name text,
  joined_at timestamptz default now(),
  penalty_points integer default 0,
  penalty_reason text
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  home_participant_id uuid references public.participants(id) on delete set null,
  away_participant_id uuid references public.participants(id) on delete set null,
  round integer,
  status text default 'pending',
  home_score integer,
  away_score integer,
  updated_at timestamptz default now()
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  source text default 'tournament',
  created_at timestamptz default now(),
  constraint connections_distinct_users check (user_a <> user_b)
);

create unique index if not exists connections_user_pair_unique
  on public.connections (least(user_a, user_b), greatest(user_a, user_b));

create index if not exists idx_tournaments_creator_id on public.tournaments (creator_id);
create index if not exists idx_participants_tournament_id on public.participants (tournament_id);
create index if not exists idx_participants_user_id on public.participants (user_id);
create index if not exists idx_matches_tournament_id on public.matches (tournament_id);

-- Keep updated_at in sync where relevant.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row execute procedure public.set_updated_at();

-- Auto-provision profile row when a user signs up.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    nickname = coalesce(excluded.nickname, public.profiles.nickname),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.connections enable row level security;

-- Profiles
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Tournaments
drop policy if exists tournaments_select_authenticated on public.tournaments;
create policy tournaments_select_authenticated
on public.tournaments for select
to authenticated
using (true);

drop policy if exists tournaments_insert_creator on public.tournaments;
create policy tournaments_insert_creator
on public.tournaments for insert
to authenticated
with check (creator_id = auth.uid());

drop policy if exists tournaments_update_creator on public.tournaments;
create policy tournaments_update_creator
on public.tournaments for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists tournaments_delete_creator on public.tournaments;
create policy tournaments_delete_creator
on public.tournaments for delete
to authenticated
using (creator_id = auth.uid());

-- Participants
drop policy if exists participants_select_authenticated on public.participants;
create policy participants_select_authenticated
on public.participants for select
to authenticated
using (true);

drop policy if exists participants_insert_self on public.participants;
create policy participants_insert_self
on public.participants for insert
to authenticated
with check (user_id = auth.uid() or user_id is null);

drop policy if exists participants_update_creator_or_self on public.participants;
create policy participants_update_creator_or_self
on public.participants for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.tournaments t
    where t.id = participants.tournament_id
      and t.creator_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.tournaments t
    where t.id = participants.tournament_id
      and t.creator_id = auth.uid()
  )
);

drop policy if exists participants_delete_creator_or_self on public.participants;
create policy participants_delete_creator_or_self
on public.participants for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.tournaments t
    where t.id = participants.tournament_id
      and t.creator_id = auth.uid()
  )
);

-- Matches
drop policy if exists matches_select_authenticated on public.matches;
create policy matches_select_authenticated
on public.matches for select
to authenticated
using (true);

drop policy if exists matches_insert_creator on public.matches;
create policy matches_insert_creator
on public.matches for insert
to authenticated
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = matches.tournament_id
      and t.creator_id = auth.uid()
  )
);

drop policy if exists matches_update_authenticated on public.matches;
create policy matches_update_authenticated
on public.matches for update
to authenticated
using (true)
with check (true);

drop policy if exists matches_delete_creator on public.matches;
create policy matches_delete_creator
on public.matches for delete
to authenticated
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = matches.tournament_id
      and t.creator_id = auth.uid()
  )
);

-- Connections
drop policy if exists connections_select_self on public.connections;
create policy connections_select_self
on public.connections for select
to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists connections_insert_authenticated on public.connections;
create policy connections_insert_authenticated
on public.connections for insert
to authenticated
with check (true);

drop policy if exists connections_update_authenticated on public.connections;
create policy connections_update_authenticated
on public.connections for update
to authenticated
using (true)
with check (true);

drop policy if exists connections_delete_authenticated on public.connections;
create policy connections_delete_authenticated
on public.connections for delete
to authenticated
using (true);

-- DEV/QA helper RPC: inject 5 mock participants with null user_id.
-- This avoids FK failures against profiles and works with the app seed flow.
create or replace function public.seed_mock_participants(p_tournament_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  i integer;
begin
  for i in 1..5 loop
    insert into public.participants (tournament_id, user_id, team_name, joined_at)
    values (p_tournament_id, null, null, now());
  end loop;
end;
$$;

revoke all on function public.seed_mock_participants(uuid) from public;
grant execute on function public.seed_mock_participants(uuid) to authenticated;
