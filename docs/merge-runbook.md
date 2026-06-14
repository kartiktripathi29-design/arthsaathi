# Merge runbook — `ui-locked-changes` → `main`

The sequence for landing this branch on `main`. Repo: `kartiktripathi29-design/arthsaathi`.
**Human merges the PR on GitHub — never merge from the CLI.** Work top to bottom; do not skip the stop-and-confirm gates.

## 0. Pre-flight
- Confirm the working tree is clean (`git status`) and you're on the branch:
  ```sh
  git switch ui-locked-changes
  git status            # clean
  ```
- Make sure local refs are current:
  ```sh
  git fetch origin --tags
  ```

## 1. Tag a rollback point FIRST
Before touching anything, tag the current tip of `ui-locked-changes` so there's a known-good point to reset to.
```sh
git tag pre-ui-merge            # tags current HEAD
git push origin pre-ui-merge
```
Everything after this is recoverable to `pre-ui-merge` (see §6).

## 2. Update the branch from `origin/main` and resolve conflicts
Bring `main`'s latest into the branch and resolve there (so the PR merges clean).
```sh
git fetch origin
git merge origin/main           # (or: git rebase origin/main — pick one; merge is simpler to reason about here)
```
Resolve any conflicts, then `git add` the resolved files and complete the merge.

### ⛔ STOP-AND-CONFIRM gate — tax-logic / salary conflicts
If **any** conflict touches tax logic or the salary flow, **stop and get a human confirm before resolving**. These files carry correctness, not just layout:
- `src/lib/tax-slabs.ts`, `src/lib/tax-engine.ts` (or any `src/lib/tax*`)
- `src/app/dashboard/tax/optimizer/page.tsx`
- `src/app/dashboard/profile/salary/page.tsx`
- `src/app/api/parse-salary/*`, `src/app/api/tax-calc/*`
- anything under the FY / regime computation

Pure UI/CSS/copy conflicts can be resolved normally. A wrong tax-logic resolution can silently change computed numbers — do not guess.

## 3. Push the updated branch
```sh
git push origin ui-locked-changes
```

## 4. Review & merge PR #6 on GitHub (human, not CLI)
- Open **PR #6** (`ui-locked-changes` → `main`) on GitHub.
- Confirm CI / checks are green and the diff matches expectations.
- A **human merges it in the GitHub UI**. Do **not** run `git merge`/`git push` to `main` from the CLI.

## 5. Verify the Vercel deploy is green
- After the merge, watch the Vercel production deploy for `main`.
- Confirm the build succeeds and the live site loads.
- Required env vars must be set or runtime routes fail — see `docs/deploy-notes.md` (`DATABASE_URL`, `ANTHROPIC_API_KEY`, Supabase `NEXT_PUBLIC_SUPABASE_URL` + anon key).

## 6. Rollback options
Pick based on who has pulled `main`:

**A. Solo / fast (no one else has pulled the merge):** reset `main` back to the tag and force-push.
```sh
git switch main
git fetch origin
git reset --hard pre-ui-merge
git push --force-with-lease origin main
```
> ⚠️ Force-push rewrites history — only safe if no one else has pulled the merged `main`.

**B. Others have already pulled:** don't rewrite history — revert the merge commit instead.
```sh
git switch main
git revert -m 1 <merge_commit_sha>   # -m 1 keeps main's first parent, undoes the branch changes
git push origin main
```

**C. Live site (independent of git):** roll the production deployment back in **Vercel → Deployments → (previous good build) → Promote/Rollback**. This restores the live site immediately without waiting on a git revert + rebuild — do this first if the site is broken, then fix git via A or B.

## Notes
- `pre-ui-merge` is the single source of truth for "known-good before the merge." Keep it until the merge is confirmed stable in production.
- The branch contents (every commit this session) are recorded in `docs/arthvo-handoff-session5.md`.
