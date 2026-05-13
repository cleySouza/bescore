-- Nome da conta OAuth guardado em `name`; `nickname` é opcional e substitui `name` na UI quando preenchido.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text NULL;

COMMENT ON COLUMN public.profiles.name IS
  'Nome da conta (ex.: Google). nickname opcional substitui na exibição em torneios quando definido.';
