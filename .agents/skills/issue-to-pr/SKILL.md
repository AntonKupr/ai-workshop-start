---
name: issue-to-pr
description: Get the issue from GitHub repo, implement it and create a PR to the main branch
---

# Issue to PR

## Scope

Use to implement an issue or fix a bug in the project

## Checklist

1. Read the issue with `gh issue view <number>` and restate the expected behavior.
2. Read `AGENTS.md` and the related spec in `spec/` before touching any code.
3. Create a branch off `main` named `issue-<number>-<short-slug>`.
4. Run `npm ci` in a fresh checkout, then `npm test` to confirm a green baseline.
5. Add an integration test in `tests/` that reproduces the issue and fails.
6. Implement the minimal change in `src/` that makes the test pass.
7. Update `spec/` in the same change if the behavior described there changed.
8. Run `npm test` again; all tests must pass locally.
9. If any question about the decision stays open, ask it in the Slack channel
   `akupr-channel` (channel id `C0CAVCXUD54`) of the "AI Workshop at JetBrains"
   workspace (`aiworkshopatjetbrains.slack.com`), using the `SLACK_BOT_TOKEN`
   from the environment variables, and wait for the answer before proceeding.
10. Commit, push the branch, and open a PR to `main` with `gh pr create`.

## Rules

- One issue per branch and per PR; never mix unrelated changes.
- Never push directly to `main`.
- Every behavior change must come with a test covering the case in the spec.
- A failing test must exist before the fix, so the reproduction is proven.
- Never skip, delete, or weaken tests to make the suite green.
- The PR must stay unmerged; a human reviewer approves and merges it.

## Output

Open a PR to `main` that links the issue with `Closes #<number>`. The description
states the problem, the chosen solution, and how it was verified, and stays
concise. Report the PR URL back to the user.
