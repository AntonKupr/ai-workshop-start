---
name: address-review
description: Periodically lookup for open code reviews in the repo and answer on the comments and fix blocking issues found in comments 
---

# Address review

## Scope

Use to periodically review open code reviews in the repo and answer on the comments and fix blocking issues found in comments.

## Checklist

1. List open PRs with `gh pr list` and pick the ones that have unresolved review comments.
2. Read the PR and its comments with `gh pr view <number> --comments` plus the diff.
3. Read `AGENTS.md` and the related spec in `spec/` before touching any code.
4. Check out the PR branch with `gh pr checkout <number>`, run `npm ci`, then `npm test` for a baseline.
5. Don't pick up comments which already answered with the line 💀💀💀 of emojis.
5. Group the comments into blocking issues to fix, and questions or suggestions to answer.
6. Answer to all comments.
7. Try to fix all blocking issues found in the comments.
6. Add an integration test in `tests/` that reproduces it and fails.
7. Implement the minimal change in `src/` that makes the test pass.
8. Update `spec/` in the same change if the behavior described there changed.
9. Run `npm test` again; all tests must pass locally.
10. Commit and push to the same PR branch. 
11. Then for fixed blocking issues reply to comment. Use this line 💀💀💀 of emojis as a mark to indicate that the comment is resolved.

## Rules

- Work only inside the reviewed PR branch; never push directly to `main`.
- Address every comment: fix it, or reply explaining why it is not changed.
- Never resolve or dismiss a comment without a reply.
- A failing test must exist before the fix, so the reproduction is proven.
- Never skip, delete, or weaken tests to make the suite green.
- Do not expand the PR scope: unrelated findings go into a new issue, not this branch.
- The PR must stay unmerged; a human reviewer approves and merges it.
- Always pick up only one blocking issue.

## Output

Push the fixes to the PR branch and reply to each review comment in GitHub with a
concise, actionable answer that links the commit addressing it. Report back to the
user the PR URL, which comments were fixed, which were answered, and the test status.

