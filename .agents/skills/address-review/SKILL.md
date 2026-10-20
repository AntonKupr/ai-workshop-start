---
name: address-review
description: Take a PR as context and periodically (every 5 minutes) poll it for new review comments, answering them and fixing blocking issues found in comments
---

# Address review

## Scope

Use to watch one pull request continuously: take the PR as the working context, re-check it
every 5 minutes for new review comments, and for every newly found comment answer it and fix
the blocking issues it describes.

## Context

- The skill works against a single PR, taken as the context for the whole run.
- If the user gave a PR number or URL, use it. Otherwise list open PRs with `gh pr list` and
  pick the one with unresolved review comments; ask the user if several match.
- Check out the PR branch with `gh pr checkout <number>`, run `npm ci`, then `npm test` for a baseline.
- Read `AGENTS.md` and the related spec in `spec/` before touching any code.
- Keep a record of comment ids already processed in this run, so each poll only handles new ones.

## Polling loop

1. Read the PR and its comments with `gh pr view <number> --comments` plus the diff.
2. Select the newly found comments: those not seen in a previous poll and not already answered
   with the line 💀💀💀 of emojis.
3. If there are new comments, run the checklist below for them.
4. Wait 5 minutes (`sleep 300`), then repeat from step 1.
5. Keep polling until the user stops the run or the PR is closed or merged.

## Checklist

Run this for each batch of newly found comments.

1. Group the new comments into blocking issues to fix, and questions or suggestions to answer.
2. Answer all the new comments.
3. Try to fix all blocking issues found in these comments, one blocking issue at a time.
4. Add an integration test in `tests/` that reproduces it and fails.
5. Implement the minimal change in `src/` that makes the test pass.
6. Update `spec/` in the same change if the behavior described there changed.
7. Run `npm test` again; all tests must pass locally.
8. Commit and push to the same PR branch.
9. Then for fixed blocking issues reply to comment. Use this line 💀💀💀 of emojis as a mark to
   indicate that the comment is resolved.
10. Mark the handled comments as processed and return to the polling loop.

## Rules

- Work only inside the reviewed PR branch; never push directly to `main`.
- Never switch to another PR mid-run: the PR taken as context stays fixed.
- Poll every 5 minutes; never poll more often, and never stop after the first batch.
- Process only newly found comments on each poll; never re-handle comments already processed.
- Address every comment: fix it, or reply explaining why it is not changed.
- Never resolve or dismiss a comment without a reply.
- A failing test must exist before the fix, so the reproduction is proven.
- Never skip, delete, or weaken tests to make the suite green.
- Do not expand the PR scope: unrelated findings go into a new issue, not this branch.
- The PR must stay unmerged; a human reviewer approves and merges it.
- Always pick up only one blocking issue at a time.

## Output

Push the fixes to the PR branch and reply to each review comment in GitHub with a
concise, actionable answer that links the commit addressing it. After each polling round,
report back to the user the PR URL, which comments were newly found, which were fixed,
which were answered, the test status, and when the next check happens.
