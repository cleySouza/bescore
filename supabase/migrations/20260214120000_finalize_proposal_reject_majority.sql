-- Maioria de reprovação: marca proposta como rejected, limpa placar na partida e mantém status pending.

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
  v_reject int;
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

  -- Strict majority approve vs eligible count
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

  SELECT COUNT(*)::int
  INTO v_reject
  FROM public.match_score_proposal_votes v
  WHERE v.proposal_id = p_proposal_id AND v.vote = 'reject';

  -- Mesma barra que aprovação: votos explícitos de reprovação > metade dos elegíveis
  IF v_eligible > 0 AND v_reject * 2 > v_eligible THEN
    UPDATE public.match_score_proposals
    SET status = 'rejected', updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.matches
    SET
      home_score = NULL,
      away_score = NULL,
      home_penalties = NULL,
      away_penalties = NULL,
      status = 'pending',
      updated_at = now()
    WHERE id = v_prop.match_id;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
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

COMMENT ON FUNCTION public.finalize_match_score_proposal(uuid) IS
  'Aprova se maioria a favor; reprova se maioria de reject (limpa placar na partida); expira no prazo; senão pending.';
