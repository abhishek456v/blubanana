# Blubanana

## Saving work

Save progress after every piece of work, without being asked:

1. Commit every change on `main`.
2. Update this file with anything a future session needs to know, in the same commit.
3. Push with `git push origin main`, run as its own command.

The owner wants work pushed straight to `main`, with no branches or pull requests. Every push to `main` redeploys both live sites on Vercel.

Pushing is allowed by the rule `Bash(git push origin main)` in the owner's user settings. Other spellings, such as `git push` alone or a push chained after another command with `&&`, may still be blocked.

## Server functions

A push does not update the Supabase server functions in `supabase/functions/`. Each one has to be deployed on its own, and a function left behind keeps running old code while the repo looks finished. On 26 Oct 2026 `extract-deal` was still the July version and `send-due-reminders` was older than its last change.

The Supabase CLI is not installed, so deploy with npx (`--use-api` needs no Docker):

```
cd ~/Projects/crm-app && SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) npx -y supabase@2 functions deploy <name> --project-ref bbdvgeavtxfxykhiafbp --use-api
```

The auto-mode safety check blocks Claude from running this, so the owner runs it in Terminal. `verify_jwt` for each function comes from `supabase/config.toml`.

After any change under `supabase/functions/`, compare the function's last commit time with its live `updated_at` from `GET https://api.supabase.com/v1/projects/bbdvgeavtxfxykhiafbp/functions` (same keychain token).
