-- RLS: leitura pública só em torneios não-privados; utilizadores autenticados não veem toda a base.
-- Aplica no SQL Editor do Supabase (dev e prod). Revê políticas duplicadas antes se já tiveres nomes iguais.
--
-- Notas:
-- - Para torneios públicos, anon ainda recebe colunas completas (ex.: invite_code). Para ocultar código,
--   usa uma VIEW só-leitura ou RPC sem essa coluna.
-- - settings.isPrivate: mesma convenção do app (JSON em tournaments.settings).

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_is_public(settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT COALESCE((settings->>'isPrivate')::boolean, false);
$$;

COMMENT ON FUNCTION public.tournament_is_public(jsonb) IS
  'Torneio considerado público quando settings.isPrivate não é true.';

CREATE OR REPLACE FUNCTION public.get_my_tournament_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tournament_id
  FROM public.participants
  WHERE user_id = auth.uid()
    AND tournament_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_my_tournament_ids() IS
  'IDs de torneios em que o utilizador actual é participante (RLS bypass dentro da função).';

REVOKE ALL ON FUNCTION public.get_my_tournament_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_tournament_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_tournament_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.tournament_is_public(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tournament_is_public(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.tournament_is_public(jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- DROP políticas antigas (nomes usados em dev e em prod)
-- -----------------------------------------------------------------------------

-- tournaments
DROP POLICY IF EXISTS "Tournament_Select_Policy" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_select_authenticated" ON public.tournaments;
DROP POLICY IF EXISTS "Creator can delete own tournament" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_delete_creator" ON public.tournaments;
DROP POLICY IF EXISTS "Tournament_Insert_Policy" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_insert_creator" ON public.tournaments;
DROP POLICY IF EXISTS "creator can update tournament" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_update_creator" ON public.tournaments;

-- matches
DROP POLICY IF EXISTS "Creator can delete tournament matches" ON public.matches;
DROP POLICY IF EXISTS "matches_delete_creator" ON public.matches;
DROP POLICY IF EXISTS "Match_Update_Policy" ON public.matches;
DROP POLICY IF EXISTS "creator can insert matches" ON public.matches;
DROP POLICY IF EXISTS "matches_insert_creator" ON public.matches;
DROP POLICY IF EXISTS "creator can update matches" ON public.matches;
DROP POLICY IF EXISTS "matches_update_creator" ON public.matches;
DROP POLICY IF EXISTS "creator can view matches" ON public.matches;
DROP POLICY IF EXISTS "participants can view matches" ON public.matches;
DROP POLICY IF EXISTS "matches_select_authenticated" ON public.matches;
DROP POLICY IF EXISTS "matches_select_participant_or_creator" ON public.matches;
DROP POLICY IF EXISTS "matches_update_own_game_scores" ON public.matches;

-- participants
DROP POLICY IF EXISTS "Creator can delete tournament participants" ON public.participants;
DROP POLICY IF EXISTS "participants_delete_creator_or_self" ON public.participants;
DROP POLICY IF EXISTS "creator can manage participants" ON public.participants;
DROP POLICY IF EXISTS "participants_insert_self" ON public.participants;
DROP POLICY IF EXISTS "creator can update participant team names" ON public.participants;
DROP POLICY IF EXISTS "participants_update_creator_or_self" ON public.participants;
DROP POLICY IF EXISTS "creator can view all participants" ON public.participants;
DROP POLICY IF EXISTS "participants can view others in same tournament" ON public.participants;
DROP POLICY IF EXISTS "users can join tournaments" ON public.participants;
DROP POLICY IF EXISTS "participants_select_authenticated" ON public.participants;

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tournaments_select_anon_public
  ON public.tournaments
  FOR SELECT
  TO anon
  USING (public.tournament_is_public(settings::jsonb));

CREATE POLICY tournaments_select_authenticated_scoped
  ON public.tournaments
  FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR id IN (SELECT public.get_my_tournament_ids())
    OR public.tournament_is_public(settings::jsonb)
  );

CREATE POLICY tournaments_insert_creator
  ON public.tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY tournaments_update_creator
  ON public.tournaments
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY tournaments_delete_creator
  ON public.tournaments
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select_anon_public_tournament
  ON public.matches
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND public.tournament_is_public(t.settings::jsonb)
    )
  );

CREATE POLICY matches_select_authenticated_scoped
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND (
          t.creator_id = auth.uid()
          OR public.tournament_is_public(t.settings::jsonb)
          OR t.id IN (SELECT public.get_my_tournament_ids())
        )
    )
  );

CREATE POLICY matches_insert_creator
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY matches_update_creator
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY matches_update_participants_own_match
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.participants p
      WHERE (p.id = matches.home_participant_id OR p.id = matches.away_participant_id)
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.participants p
      WHERE (p.id = matches.home_participant_id OR p.id = matches.away_participant_id)
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY matches_delete_creator
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- participants
-- -----------------------------------------------------------------------------

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY participants_select_anon_public_tournament
  ON public.participants
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND public.tournament_is_public(t.settings::jsonb)
    )
  );

CREATE POLICY participants_select_authenticated_scoped
  ON public.participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND (
          t.creator_id = auth.uid()
          OR public.tournament_is_public(t.settings::jsonb)
          OR t.id IN (SELECT public.get_my_tournament_ids())
        )
    )
  );

CREATE POLICY participants_insert_self
  ON public.participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY participants_insert_creator
  ON public.participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY participants_update_creator_or_self
  ON public.participants
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY participants_delete_creator_or_self
  ON public.participants
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tournaments t
      WHERE t.id = participants.tournament_id
        AND t.creator_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- profiles (sem SELECT para anon)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_authenticated_scoped
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.participants p_self
      INNER JOIN public.participants p_other
        ON p_self.tournament_id = p_other.tournament_id
      WHERE p_self.user_id = auth.uid()
        AND p_other.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.participants p
      INNER JOIN public.tournaments t ON t.id = p.tournament_id
      WHERE p.user_id = profiles.id
        AND t.creator_id = auth.uid()
    )
  );

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
