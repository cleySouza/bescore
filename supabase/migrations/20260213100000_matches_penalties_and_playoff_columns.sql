-- Colunas usadas pelo app e por finalize_match_score_proposal (pênaltis / mata-mata).
-- Se só aplicaste 20260210… e 20260212…, estas colunas podem faltar — corrige o erro
-- "column home_penalties of relation matches does not exist".

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS playoff_pair_index smallint NULL,
  ADD COLUMN IF NOT EXISTS playoff_leg smallint NULL,
  ADD COLUMN IF NOT EXISTS home_penalties smallint NULL,
  ADD COLUMN IF NOT EXISTS away_penalties smallint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_playoff_leg_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_playoff_leg_check
      CHECK (playoff_leg IS NULL OR playoff_leg IN (1, 2));
  END IF;
END $$;

COMMENT ON COLUMN public.matches.playoff_pair_index IS 'Confronto do mata-mata (0 = primeiro semifinal/final), mesmo índice nas duas pernas.';
COMMENT ON COLUMN public.matches.playoff_leg IS '1 = ida, 2 = volta (NULL = partida única / fase de grupos).';
COMMENT ON COLUMN public.matches.home_penalties IS 'Gols na disputa de pênaltis para o mandante (quando aplicável).';
COMMENT ON COLUMN public.matches.away_penalties IS 'Gols na disputa de pênaltis para o visitante (quando aplicável).';
