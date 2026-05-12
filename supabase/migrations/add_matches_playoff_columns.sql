-- Rodadas de mata-mata (campeonato): ida/volta e desempate nos pênaltis.
-- Execute no SQL Editor do Supabase ou via CLI antes de usar playoffTwoLegged / penalties no app.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS playoff_pair_index smallint NULL,
  ADD COLUMN IF NOT EXISTS playoff_leg smallint NULL CHECK (playoff_leg IS NULL OR playoff_leg IN (1, 2)),
  ADD COLUMN IF NOT EXISTS home_penalties smallint NULL,
  ADD COLUMN IF NOT EXISTS away_penalties smallint NULL;

COMMENT ON COLUMN public.matches.playoff_pair_index IS 'Confronto do mata-mata (0 = primeiro semifinal/final), mesmo índice nas duas pernas.';
COMMENT ON COLUMN public.matches.playoff_leg IS '1 = ida, 2 = volta (NULL = partida única / fase de grupos).';
COMMENT ON COLUMN public.matches.home_penalties IS 'Gols na disputa de pênaltis para o mandante (quando aplicável).';
COMMENT ON COLUMN public.matches.away_penalties IS 'Gols na disputa de pênaltis para o visitante (quando aplicável).';
