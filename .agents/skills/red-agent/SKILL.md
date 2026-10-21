---
name: red-agent
description: Hunt for UI bugs by running the web view in a browser and exploring it against the spec
---

# Red agent

## Scope

Use when asked to look for UI bugs in the web view, without a specific bug to reproduce. The
expected behavior is `spec/web.md`; anything the page does differently is a finding.

## Setup

1. `npm ci && npm run build` — the page is built into `dist/`, which is gitignored.
2. Start the server in the background: `./skill-atlas web`. It listens on `127.0.0.1:4173` and
   answers `/` with 503 until `dist/web` exists, so wait for a 200 before opening the page.
3. Open `http://localhost:4173` in the browser and keep the devtools console open; a console error
   or an unhandled rejection is a finding on its own.
4. Scan the bundled `fixture` directory, not a GitHub repository: `GITHUB_TOKEN` is not set, so
   GitHub scans share the anonymous rate limit of about 60 requests an hour.

## Exploration

Work through the page feature by feature, reading `spec/web.md` for each one.

1. Scan: a valid directory, then Enter instead of *Scan*, then an empty input, a path that does not
   exist, and an unreachable GitHub URL. The header must read `<owner>/<repo> · N skills` and the
   first skill must be selected.
2. List: names sorted, the description cut to its first sentence, `also in <paths>` for copies.
3. Detail pane: name, description, the other front matter, the body rendered as Markdown, and the
   link pointing at the scanned commit. Click other skills and check the pane follows.
4. Filter: a match, a different case, leading and trailing spaces, a word that only appears later in
   the description, and a filter matching nothing (`No skills match “<filter>”`). The header still
   counts every skill, the first match becomes selected, and a new scan clears the filter.
5. Banners: the fixture's malformed front matter must show a warning banner; an unreachable
   repository must show the CLI's message in an error banner.
6. Safety: a SKILL.md with HTML or a script in it must render sanitized, with nothing executed.
7. Edge cases worth pushing: a very long name or description, a skill with no body, rapid typing in
   the filter, scanning twice in a row, resizing to a narrow window, and reloading after a scan.

## Rules

- Take a screenshot after every interaction and confirm the expected state before continuing.
- Compare against `spec/web.md`, not against intuition; if the spec is silent, say so in the report
  instead of calling it a bug.
- Do not fix anything and do not change the project; this skill only finds and reports.
- Every finding must be reproducible: record the exact steps, input, and what was seen.
- File every confirmed finding as a GitHub issue: one issue per bug, never several bugs in one.
- Label each issue `Delegated to AI`; create the label first if the repository does not have it.
- Create at most 3 issues in one session; report the remaining findings without filing them.

## Output

A list of findings, each with steps to reproduce, expected behavior (quoting `spec/web.md`), actual
behavior, a screenshot, and a severity of Blocking, Major, Medium, Trivial or Informational. State
explicitly which features were explored and found correct.

File the findings as GitHub issues, one per bug, labelled `Delegated to AI`, with the same steps,
expected and actual behavior, screenshot and severity. Give the link to every issue created, and
list the findings left unfiled once the limit of 3 issues per session is reached.
