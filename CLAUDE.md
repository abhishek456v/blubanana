# Blubanana

## Saving work

Save progress after every piece of work, without being asked:

1. Commit every change.
2. Push it to GitHub.
3. Update this file with anything a future session needs to know.

Pushing straight to `main` is blocked, and pushing to `main` redeploys both live sites on Vercel. So cut a new branch from `origin/main`, commit there, push the branch, and give the owner this link to merge it:

`https://github.com/abhishek456v/blubanana/compare/main...<branch>`

Merging takes three clicks on that page: Create pull request, Merge, Confirm. Once it is merged, check out `main` locally and fast-forward it to `origin/main`.
