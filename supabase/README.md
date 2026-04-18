# Supabase Migrations

This folder stores SQL migrations for the BeScore app database schema.

## Files

- [migrations/20260418220000_init_app_schema.sql](migrations/20260418220000_init_app_schema.sql): baseline schema (profiles, tournaments, participants, matches, connections), RLS policies, helper triggers, and `seed_mock_participants` RPC.

## Apply In Production

1. Open Supabase Dashboard for the target project.
2. Go to SQL Editor.
3. Run [migrations/20260418220000_init_app_schema.sql](migrations/20260418220000_init_app_schema.sql).
4. Verify tables exist:
   - `public.profiles`
   - `public.tournaments`
   - `public.participants`
   - `public.matches`
   - `public.connections`

## Quick Validation

Run these queries in SQL Editor:

```sql
select count(*) from public.tournaments;
select count(*) from public.participants;
select count(*) from public.matches;
```

## Notes

- Schema is not auto-created by Vercel/frontend deploys.
- Each Supabase project (dev/staging/prod) must receive migrations.
- Keep future DB changes as new files in `supabase/migrations/`.
