---
name: status-update
description: Collect the GitHub activity since yesterday (UTC) and post a readable status report to Slack
---

# Status update

## Scope

Use when the user asks for a status update, a daily report, or a summary of
what happened in the repository since yesterday.

## Checklist

1. Compute the UTC window: `SINCE=$(date -u -v-1d +%Y-%m-%dT00:00:00Z)` on macOS
   (`date -u -d 'yesterday' +%Y-%m-%dT00:00:00Z` on Linux). Everything with a
   timestamp `>= $SINCE` belongs to the report.
2. Resolve the repository with `gh repo view --json nameWithOwner` and refresh the
   local state with `git fetch --all --prune --tags`.
3. Collect created branches: list remote branches whose first commit date is in the
   window, e.g.
   `git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:iso8601-strict)' refs/remotes/origin`.
4. Collect pushed commits in the window across branches, e.g.
   `git log --all --since="$SINCE" --date=iso-strict --pretty='%h %ad %an %s'`.
5. Collect created PRs: `gh pr list --state all --limit 100 --json number,title,url,author,createdAt,mergedAt`
   and keep the ones with `createdAt >= $SINCE`.
6. Collect merged PRs: from the same output keep the ones with `mergedAt >= $SINCE`.
7. Collect created issues: `gh issue list --state all --limit 100 --json number,title,url,author,createdAt,closedAt,stateReason`
   and keep the ones with `createdAt >= $SINCE`.
8. Collect resolved issues: from the same output keep the ones closed in the window
   (`closedAt >= $SINCE`).
9. Build the report (see Output) and post it to Slack with the
   `SLACK_BOT_TOKEN` from the environment variables:

   ```bash
   curl -sS -X POST https://slack.com/api/chat.postMessage \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     -H 'Content-type: application/json; charset=utf-8' \
     --data @payload.json
   ```

   with `payload.json` containing `{"channel": "C0CAVCXUD54", "text": "<report>"}`.
10. Check the Slack response: `"ok": true` means delivered; otherwise report the
    returned error and do not claim success.

## Rules

- All timestamps are UTC; never use the local timezone for the window.
- The window starts at `00:00:00Z` yesterday and ends now, so it always covers
  yesterday and today.
- Report only facts read from `git` and `gh`; never invent or guess activity.
- Never print or echo the value of `SLACK_BOT_TOKEN`.
- Post to the `akupr-channel` channel (channel id `C0CAVCXUD54`) of the
  "AI Workshop at JetBrains" workspace (`aiworkshopatjetbrains.slack.com`) only.
- Send one message per run; do not split the report across messages.
- Empty sections are listed as `none` instead of being dropped, so the reader
  sees what was checked.
- Bots and automation commits are included but marked, so human work stays
  distinguishable.

## Output

A single Slack message starting with
`Status update <repo> — since <YYYY-MM-DD> 00:00 UTC`, followed by the sections
`Branches created`, `Commits pushed`, `PRs created`, `PRs merged`,
`Issues created`, `Issues resolved`. Each entry is one short line with the
author and a link (`#<number> <title> — <author> — <url>` for PRs and issues,
`<sha> <subject> — <author>` for commits). Keep it readable in Slack: plain
text, no tables, long lists truncated to the 10 most recent entries with a
`+N more` line. Report the Slack message link or timestamp back to the user.
