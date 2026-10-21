---
name: PR-rebaser
description: Take a GitHub PR, check it for conflicts with the default branch, check out its branch, rebase it onto the up-to-date default branch resolving the conflicts, and open a new PR
---

# PR rebaser

## Scope

Use to bring a stale pull request back on top of the default branch: detect whether it conflicts,
rebase its branch onto the latest default branch, resolve the conflicts, and open a new PR with
the rebased branch.

## Context

- The skill works against a single PR, taken as the context for the whole run.
- If the user gave a PR number or URL, use it. Otherwise list open PRs with `gh pr list` and ask
  the user which one to rebase.
- Read the PR with `gh pr view <number>` plus its diff, and restate what it changes.
- Resolve the default branch with `gh repo view --json defaultBranchRef`; never assume `main`.
- Read `AGENTS.md` and the related spec in `spec/` before resolving any conflict.

## Checklist

1. Read the PR, its diff, and the list of commits it contains.
2. Fetch the latest default branch with `git fetch origin <default>`.
3. Check for conflicts: read `mergeable` and `mergeStateStatus` from
   `gh pr view <number> --json mergeable,mergeStateStatus`, and confirm locally with
   `git merge-tree` or a dry rebase. If the branch is already up to date and conflict-free,
   report it and stop.
4. Check out the PR branch with `gh pr checkout <number>`, run `npm ci`, then `npm test` for a
   baseline; record which tests already failed before the rebase.
5. Create a rebase branch off the PR branch named `<pr-branch>-rebased` and work only there, so
   the original PR branch stays untouched.
6. Rebase onto the default branch with `git rebase origin/<default>`.
7. Resolve each conflict one commit at a time, keeping the intent of the PR and the behavior
   described in `spec/`; continue with `git rebase --continue`.
8. Never resolve a conflict by dropping either side blindly; if the intent is unclear, ask the
   user before continuing.
9. Update `spec/` in the same change if the rebase changed the behavior described there.
10. Run `npm test` again; all tests must pass locally, and no test may regress against the
    baseline.
11. Push the rebased branch and open a new PR to the default branch with `gh pr create`.
12. Leave a comment on the original PR linking the new one, and leave the original PR open for a
    human to close.

## Rules

- Never push directly to the default branch, and never force-push the original PR branch.
- Never merge the default branch into the PR branch: the history must be rebased, not merged.
- Keep the PR scope: the rebase must not add unrelated changes or new features.
- Preserve the original commits and their authorship; squash only if the user asks for it.
- Every conflict resolution must be covered by the tests that already exist, or by a new test in
  `tests/` when the resolution changes behavior.
- Never skip, delete, or weaken tests to make the suite green.
- If the rebase goes wrong, `git rebase --abort` and start over instead of patching a broken state.
- Both PRs stay unmerged; a human reviewer approves and merges.

## Output

Open a new PR with the rebased branch against the default branch. The description links the
original PR, lists the conflicting files and how each conflict was resolved, and states how it was
verified. Report back to the user the new PR URL, the conflicts found, the resolutions chosen, and
the test status.
