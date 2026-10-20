---
name: code-review
description: Review a change for correctness, tests, and spec alignment before merge
---

# Code review

## Scope

Use when reviewing a diff, pull request, or a set of local changes.

## Checklist

1. Understand the change: read the diff and the related spec in `spec/`.
2. Check correctness and edge cases.
3. Check tests and docs.
4. Report findings grouped as blocking / non-blocking.

## Rules

- Every behavior change must come with a unit test covering the case in the spec.
- If the change alters behavior described in `spec/`, the spec must be updated in the same change.

## Output

add comments to the PR in github. The comments should be concise but actionable.
