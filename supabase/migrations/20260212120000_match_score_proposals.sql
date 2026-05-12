-- Pending score proposals with participant voting (MVP).
-- Majority rule (see finalize_match_score_proposal): approve_count > 50% of *eligible*
-- tournament participants (users with a participant row and user_id set). Abstentions
-- do not raise the bar — denominator is full eligible count, not votes cast.

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE public.match_score_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments (id) ON DELETE CASCADE,
  proposed_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  home_score integer NOT NULL,
  away_score integer NOT NULL,
  home_penalties integer NULL,
  away_penalties integer NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX match_score_proposals_one_pending_per_match
  ON public.match_score_proposals (match_id)
  WHERE (status = 'pending');

CREATE INDEX match_score_proposals_tournament_id_idx
  ON public.match_score_proposals (tournament_id);

CREATE TABLE public.match_score_proposal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.match_score_proposals (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('approve', 'reject')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX match_score_proposal_votes_proposal_id_idx
  ON public.match_score_proposal_votes (proposal_id);

-- -----------------------------------------------------------------------------
-- BEFORE INSERT: normalize proposal (security + single pending)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_score_proposals_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tid uuid;
  v_status text;
  v_eligible int;
BEGIN
  SELECT m.tournament_id, m.status
  INTO v_tid, v_status
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'match not found';
  END IF;

  IF v_status = 'finished' THEN
    RAISE EXCEPTION 'match already finished';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_score_proposals p
    WHERE p.match_id = NEW.match_id AND p.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending proposal already exists for this match';
  END IF;

  SELECT COUNT(*)::int
  INTO v_eligible
  FROM public.participants p
  WHERE p.tournament_id = v_tid AND p.user_id IS NOT NULL;

  IF v_eligible < 1 THEN
    RAISE EXCEPTION 'no eligible voters (participants with user)';
  END IF;

  NEW.tournament_id := v_tid;
  NEW.proposed_by_user_id := auth.uid();
  -- Short MVP window; keep duration aligned with SCORE_PROPOSAL_DEFAULT_DEADLINE_MS in app.
  NEW.expires_at := now() + interval '15 minutes';
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_score_proposals_before_insert ON public.match_score_proposals;
CREATE TRIGGER trg_match_score_proposals_before_insert
  BEFORE INSERT ON public.match_score_proposals
  FOR EACH ROW
  EXECUTE PROCEDURE public.match_score_proposals_before_insert();

COMMENT ON FUNCTION public.match_score_proposals_before_insert() IS
  'Sets tournament_id, proposer, fixed expiry (15m), blocks duplicate pending / finished matches.';

-- -----------------------------------------------------------------------------
-- Finalize: majority approve vs eligible count, or expire (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_match_score_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop record;
  v_eligible int;
  v_submitter_is_participant boolean;
  v_auto int;
  v_explicit int;
  v_total int;
BEGIN
  SELECT * INTO v_prop
  FROM public.match_score_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_prop.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_prop.status);
  END IF;

  SELECT COUNT(*)::int
  INTO v_eligible
  FROM public.participants p
  WHERE p.tournament_id = v_prop.tournament_id AND p.user_id IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.tournament_id = v_prop.tournament_id
      AND p.user_id = v_prop.proposed_by_user_id
  ) INTO v_submitter_is_participant;

  v_auto := CASE WHEN v_submitter_is_participant THEN 1 ELSE 0 END;

  SELECT COUNT(*)::int
  INTO v_explicit
  FROM public.match_score_proposal_votes v
  WHERE v.proposal_id = p_proposal_id AND v.vote = 'approve';

  v_total := v_auto + v_explicit;

  -- Strict majority of eligible count: approves > eligible / 2  <=>  2*approves > eligible
  IF v_eligible > 0 AND v_total * 2 > v_eligible THEN
    UPDATE public.match_score_proposals
    SET status = 'approved', updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.matches
    SET
      home_score = v_prop.home_score,
      away_score = v_prop.away_score,
      home_penalties = v_prop.home_penalties,
      away_penalties = v_prop.away_penalties,
      status = 'finished',
      updated_at = now()
    WHERE id = v_prop.match_id AND COALESCE(status, '') <> 'finished';

    RETURN jsonb_build_object('ok', true, 'status', 'approved');
  END IF;

  IF v_prop.expires_at <= now() THEN
    UPDATE public.match_score_proposals
    SET status = 'expired', updated_at = now()
    WHERE id = p_proposal_id;
    RETURN jsonb_build_object('ok', true, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_match_score_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_match_score_proposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_match_score_proposal(uuid) TO service_role;

COMMENT ON FUNCTION public.finalize_match_score_proposal(uuid) IS
  'If approve_count > half of eligible participants, apply scores; if past expires_at, mark expired.';

-- -----------------------------------------------------------------------------
-- RLS: proposals
-- -----------------------------------------------------------------------------

ALTER TABLE public.match_score_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_score_proposals_select_anon_public
  ON public.match_score_proposals
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_score_proposals.tournament_id
        AND public.tournament_is_public(t.settings::jsonb)
    )
  );

CREATE POLICY match_score_proposals_select_authenticated_scoped
  ON public.match_score_proposals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_score_proposals.tournament_id
        AND (
          t.creator_id = auth.uid()
          OR public.tournament_is_public(t.settings::jsonb)
          OR t.id IN (SELECT public.get_my_tournament_ids())
        )
    )
  );

CREATE POLICY match_score_proposals_insert_participant_or_creator
  ON public.match_score_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = match_score_proposals.tournament_id
        AND (
          t.creator_id = auth.uid()
          OR t.id IN (SELECT public.get_my_tournament_ids())
        )
    )
  );

-- -----------------------------------------------------------------------------
-- RLS: votes
-- -----------------------------------------------------------------------------

ALTER TABLE public.match_score_proposal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_score_proposal_votes_select_anon_public
  ON public.match_score_proposal_votes
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.match_score_proposals p
      JOIN public.tournaments t ON t.id = p.tournament_id
      WHERE p.id = match_score_proposal_votes.proposal_id
        AND public.tournament_is_public(t.settings::jsonb)
    )
  );

CREATE POLICY match_score_proposal_votes_select_authenticated_scoped
  ON public.match_score_proposal_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.match_score_proposals p
      JOIN public.tournaments t ON t.id = p.tournament_id
      WHERE p.id = match_score_proposal_votes.proposal_id
        AND (
          t.creator_id = auth.uid()
          OR public.tournament_is_public(t.settings::jsonb)
          OR t.id IN (SELECT public.get_my_tournament_ids())
        )
    )
  );

CREATE POLICY match_score_proposal_votes_insert_eligible
  ON public.match_score_proposal_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.match_score_proposals p
      JOIN public.participants part
        ON part.tournament_id = p.tournament_id AND part.user_id = auth.uid()
      WHERE p.id = proposal_id
        AND p.status = 'pending'
        AND p.proposed_by_user_id IS DISTINCT FROM auth.uid()
    )
  );

CREATE POLICY match_score_proposal_votes_update_own
  ON public.match_score_proposal_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_score_proposals p
      WHERE p.id = proposal_id AND p.status = 'pending'
    )
  );

-- -----------------------------------------------------------------------------
-- When scoreValidation is on, block direct client updates that finish the match
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS matches_update_creator ON public.matches;
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
    AND NOT (
      EXISTS (
        SELECT 1
        FROM public.tournaments t
        WHERE t.id = matches.tournament_id
          AND COALESCE((t.settings->>'scoreValidation')::boolean, false)
      )
      AND COALESCE(matches.status, '') = 'finished'
    )
  );

DROP POLICY IF EXISTS matches_update_participants_own_match ON public.matches;
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
    AND NOT (
      EXISTS (
        SELECT 1
        FROM public.tournaments t
        WHERE t.id = matches.tournament_id
          AND COALESCE((t.settings->>'scoreValidation')::boolean, false)
      )
      AND COALESCE(matches.status, '') = 'finished'
    )
  );

-- -----------------------------------------------------------------------------
-- Realtime (Supabase): allow clients to subscribe to proposal events
-- -----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_score_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_score_proposal_votes;
