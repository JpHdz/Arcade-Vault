-- SPEC 06 — games, scores and per-game stats.
-- The public may read everything and write nothing: there is no insert,
-- update or delete policy. Only the server-side secret key (service_role,
-- which bypasses RLS) inserts scores, through the submitScore Server Action.

create table public.games (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  title text not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games (id) on delete restrict,
  player_name text not null check (player_name ~ '^[A-Z0-9_]{1,10}$'),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

-- Leaderboard order: score desc, then the earlier run first.
create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);
create index scores_recent_idx on public.scores (created_at desc);
create index scores_game_player_idx on public.scores (game_id, player_name);

create view public.game_stats with (security_invoker = true) as
  select g.id as game_id, max(s.score) as best, count(s.id) as plays
  from public.games g
  left join public.scores s on s.game_id = g.id
  group by g.id;

-- Row level security.
alter table public.games enable row level security;
alter table public.scores enable row level security;

-- Explicit grants: read-only for the public roles.
revoke all on public.games from anon, authenticated;
revoke all on public.scores from anon, authenticated;
revoke all on public.game_stats from anon, authenticated;

grant select on public.games to anon, authenticated;
grant select on public.scores to anon, authenticated;
grant select on public.game_stats to anon, authenticated;

grant select on public.games to service_role;
grant select, insert on public.scores to service_role;

create policy "Games are readable by everyone"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "Scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Seed: the catalog in lib/games.ts. A new game needs its row added by a
-- migration in the same change that adds it to the catalog.
insert into public.games (id, title) values
  ('asteroides', 'ASTEROIDES'),
  ('bloque-buster', 'BLOQUE BUSTER'),
  ('caida', 'CAÍDA'),
  ('serpentina', 'SERPENTINA'),
  ('gloton', 'GLOTÓN'),
  ('invasores', 'INVASORES'),
  ('rocas', 'ROCAS'),
  ('ranaria', 'RANARIA'),
  ('duelo-pixel', 'DUELO PIXEL');
