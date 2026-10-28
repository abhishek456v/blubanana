# Blubanana

## Saving work

Save progress after every piece of work, without being asked:

1. Commit every change on `main`.
2. Update this file with anything a future session needs to know, in the same commit.
3. Push with `git push origin main`, run as its own command.

The owner wants work pushed straight to `main`, with no branches or pull requests. Every push to `main` redeploys both live sites on Vercel.

Pushing is allowed by the rule `Bash(git push origin main)` in the owner's user settings. Other spellings, such as `git push` alone or a push chained after another command with `&&`, may still be blocked.
