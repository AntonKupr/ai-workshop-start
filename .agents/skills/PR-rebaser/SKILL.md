---
name: PR-rebaser
description: Take a GitHub PR, check it for conflicts with the default branch, check out its branch, merge the up-to-date default branch into it resolving the conflicts, and push to the original PR branch
---

# PR rebaser

## Scope

Use to bring a stale pull request back in sync with the default branch: detect whether it
conflicts, merge the latest default branch into its branch, resolve the conflicts, and push the
result to the original PR branch.

## Context

- The skill works against a single PR, taken as the context for the whole run.
- If the user gave a PR number or URL, use it. Otherwise list open PRs with `gh pr list` and ask
  the user which one to update.
- Read the PR with `gh pr view <number>` plus its diff, and restate what it changes.
- Resolve the default branch with `gh repo view --json defaultBranchRef`; never assume `main`.
- Read `AGENTS.md` and the related spec in `spec/` before resolving any conflict.

## Checklist

1. Read the PR, its diff, and the list of commits it contains.
2. Fetch the latest default branch with `git fetch origin <default>`.
3. Check for conflicts: read `mergeable` and `mergeStateStatus` from
   `gh pr view <number> --json mergeable,mergeStateStatus`, and confirm locally with
   `git merge-tree`. If the branch is already up to date and conflict-free, report it and stop.
4. Check out the PR branch with `gh pr checkout <number>`, run `npm ci`, then `npm test` for a
   baseline; record which tests already failed before the merge.
5. Merge the default branch into the PR branch with `git merge origin/<default>`.
6. Resolve each conflict keeping the intent of the PR and the behavior described in `spec/`, then
   stage the files and complete the merge with `git commit`.
7. Never resolve a conflict by dropping either side blindly; if the intent is unclear, ask the
   user before continuing.
8. Update `spec/` in the same change if the merge changed the behavior described there.
9. Run `npm test` again; all tests must pass locally, and no test may regress against the
   baseline.
10. Push the merge commit to the original PR branch and confirm the PR now reports as mergeable.

## Rules

- Never push directly to the default branch; the only branch you push to is the PR branch.
- Never rebase or rewrite the PR history: the default branch is merged in, not rebased onto.
- Never force-push the PR branch; the merge commit is added on top of the existing history.
- Keep the PR scope: the merge must not add unrelated changes or new features.
- Preserve the original commits and their authorship.
- Every conflict resolution must be covered by the tests that already exist, or by a new test in
  `tests/` when the resolution changes behavior.
- Never skip, delete, or weaken tests to make the suite green.
- If the merge goes wrong, `git merge --abort` and start over instead of patching a broken state.
- The PR stays unmerged; a human reviewer approves and merges it.

## Output

Push the merge commit to the original PR branch so the existing PR becomes mergeable again.
Comment on the PR listing the conflicting files, how each conflict was resolved, and how it was
verified. Report back to the user the PR URL, the conflicts found, the resolutions chosen, and the
test status.
