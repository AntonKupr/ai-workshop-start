---
name: promotion-post-writer
description: Read the code base of the Skill Atlas web application, write a long promotion post that sells it, and post it to Slack
---

# Promotion post writer

## Scope

Use when the user asks for a promotion, launch, marketing or "sell it" post about this
web application — the Skill Atlas page served by `./skill-atlas web` and described in
`spec/web.md`. Not for release notes or a status report: those are facts about a change,
this is a post that sells the product. The finished post is posted to Slack.

## Checklist

1. Read the product facts before writing a single sentence; the post is built from the
   code base, never from memory:
   - `README.md` — the pitch, the two entry points, the commands a reader can copy.
   - `spec/analysis.md` — what is scanned and what comes out: input, output, the
     `fetch → find → parse` core, the performance budget, the handling of copies.
   - `spec/web.md` — the page itself: the repository field, the list, the rendered
     `SKILL.md`, the filter, the **Group by shared words** toggle, the banners, the
     `GET /api/scan` API.
   - `spec/cli.md` — the command line, for the "same scan in your terminal" line.
   - `web/` and `src/` — confirm a feature exists in the code before claiming it:
     `web/App.tsx`, `web/SkillView.tsx`, `web/filter.ts`, `web/group.ts`,
     `src/core/*`, `src/commands.ts`.
   - `package.json` — the stack and the version, if the post mentions either.
2. Note the user-visible value of each feature, one line per feature: what the user
   does, what they get. A feature with no reader-facing value does not enter the post.
3. Run the application and look at it when the facts need a picture — `npm ci`,
   `npm run build`, `./skill-atlas web`, then `http://localhost:4173` — and scan
   `fixture/` or `.agents` so the numbers quoted in the post are real.
4. Pick the audience from the request; default to the developers and team leads who
   maintain agent skills in their repositories.
5. Write the post in the structure of Output, long form, then read it once against the
   notes from step 1 and cut every claim that is not backed by them.
6. Post the finished text to Slack with the `SLACK_BOT_TOKEN` from the environment
   variables:

   ```bash
   curl -sS -X POST https://slack.com/api/chat.postMessage \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     -H 'Content-type: application/json; charset=utf-8' \
     --data @payload.json
   ```

   with `payload.json` containing `{"channel": "C0CAVCXUD54", "text": "<post>"}`.
7. Check the Slack response: `"ok": true` means delivered; otherwise report the returned
   error and do not claim the post was published.
8. Hand the post to the user as Markdown, with the facts it rests on listed after it and
   the Slack message link or timestamp.

## Rules

- Every claim is checked against the code base or the spec. No invented benchmark, no
  invented user, no invented integration, no roadmap promise.
- Numbers come from the spec or from a real run: the default port *4173*, the
  *under 5 s* scan of intellij-community, the skill counts the page shows.
- Name the product **Skill Atlas** and keep it the subject of the post.
- Sell the outcome, not the implementation: "see every skill your repository already
  has" before "fetch → find → parse".
- The honest limits are selling points — nothing is stored, no clone, the HTML of a
  `SKILL.md` is sanitized, a scan works anonymously and goes faster with a
  `GITHUB_TOKEN` — so state them as such instead of hiding them.
- Keep the voice confident and concrete; no superlatives without a fact behind them,
  no "revolutionary", no emoji walls, at most one emoji per heading if the user asks
  for a social post.
- Commands are copy-pasteable and correct in a fenced block, exactly as the README
  spells them.
- Post to the `akupr-channel` channel (channel id `C0CAVCXUD54`) of the "AI Workshop at
  JetBrains" workspace (`aiworkshopatjetbrains.slack.com`) only; never publish the post
  anywhere else.
- Send one message per run; do not split the post across messages.
- Never print or echo the value of `SLACK_BOT_TOKEN`.
- Slack renders mrkdwn, not Markdown: write links as `<url|label>`, `*bold*` with single
  asterisks, and keep headings as plain lines — the Markdown headline markers of the
  post are dropped in the Slack text.

## Output

A Markdown post of about 400–700 words, in this order:

1. **Headline** — one line, the product and its promise.
2. **Hook** — two or three sentences on the problem: skills are scattered across
   `.agents`, `.claude`, `.github` and `agent` folders, copied between them, and nobody
   knows what the repository already has.
3. **What it is** — two or three sentences on the purpose: point Skill Atlas at a GitHub
   URL or a local directory and get every `SKILL.md` with its name, description and a
   link pinned to the scanned commit.
4. **What you get** — four to six bullets, each a feature with its payoff: the scan with
   no clone and under five seconds on a repository the size of intellij-community; the
   list with the rendered `SKILL.md` beside it; the filter over names and descriptions in
   any case; **Group by shared words**, which finds the families in your skill names;
   copies folded into one skill so the list is not noise; warnings that never stop a scan.
5. **Why now / why this** — three or four selling sentences: Ring UI, the same scan in the
   page and in the terminal, the `GET /api/scan` API for your own tooling, nothing stored,
   nothing executed.
6. **Try it** — the commands, in a fenced block:

   ```console
   $ npm ci && npm run build
   $ ./skill-atlas web
   Skill Atlas at http://localhost:4173
   ```

7. **Close** — one or two sentences and a call to action pointing at the repository.

The same post goes to Slack as a single message, converted to mrkdwn.

After the post, a short **Facts used** list: each claim with the file it came from, so the
user can check it. Mention any requested claim that was dropped for lack of support, and
report the Slack delivery — the message link or timestamp, or the error Slack returned.
