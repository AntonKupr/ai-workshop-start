---
name: demo-recorder
description: Record a short browser demo of the web view's filter and grouping features in the demo VM
---

# Demo recorder

## Scope

Use when asked to record a demo of the skill list filter or of the **Group by shared words**
grouping, both described in `spec/web.md`.

## Setup

1. Start the VM from the `template-vm` template in `.junie/vms/`; the project root is mounted at
   `/workspace` and recording starts with the VM.
2. From `/workspace`: `npm ci && npm run build` — the page is built into `dist/`, which is
   gitignored, so it must be built inside the VM.
3. Start the server in the background: `./skill-atlas web`. It listens on `127.0.0.1:4173` and
   answers `/` with 503 until `dist/web` exists, so wait for a 200 rather than the log line.
4. Open the page: `chromium --no-sandbox --disable-gpu --window-size=1100,700 http://localhost:4173`.

## Steps to record

### The filter

1. Scan the bundled fixture: type `/workspace/fixture` in the field at the top and press Enter.
   The header shows `<owner>/<repo> · N skills` and the first skill is selected.
2. Narrow the list: type `commits` in the filter field above the list; only the matching skill stays
   and the detail pane follows it.
3. Clear the filter with the field's clear control; the full list comes back.
4. Show case-insensitive matching: type `COMMITS` and confirm the lowercase `commits` skill matches.
5. Optionally type a filter that matches nothing and show `No skills match “<filter>”`.
6. Clear the filter again before moving on to the grouping steps.

### Grouping

7. Scan this project's own skills: type `/workspace/.agents` and press Enter. The header shows
   `.agents · 5 skills`, the list is flat, and the **Group by shared words** toggle under the filter
   is off.
8. Check the toggle: the list breaks into groups headed `<word> · N`, sorted by word with `Other`
   last and by name inside a group — `review · 2` over `address-review` and `code-review`, then
   `Other · 3`. The header still counts every scanned skill, and the first skill as the grouped list
   shows it is selected.
9. Click the `review` header: the group collapses, its skills disappear, the header keeps its count;
   click it again to expand.
10. Filter inside the groups: type `address`; `N` counts the matches only, so `review · 1` stays and
    a group with no match is hidden, and the detail pane follows the first match. Clear the filter.
11. Collapse a group, then press Enter in the repository field: the scan keeps the toggle checked
    and expands every group again.
12. Uncheck the toggle: the flat list sorted by name comes back.
13. Stop the VM to finish the recording.

## Rules

- Scan local directories, not a GitHub repository: `GITHUB_TOKEN` is not set, so GitHub scans share
  the anonymous rate limit of about 60 requests an hour.
- The fixture's malformed front matter warning banner is expected and does not block filtering.
- Scan `/workspace/.agents` for the grouping steps, not the `fixture`: the fixture's three skills
  share no word, so every one of them lands in `Other`. Scanning `/workspace` itself walks the whole
  tree and mixes the fixture's skills in, which changes the groups.
- Grouping reads the skills' *names* only, never their descriptions, even though the filter reads
  both.
- **Group by shared words** is a Ring UI toggle whose input is hidden behind the switch: click the
  switch or its label.
- Take a screenshot after every interaction and confirm the expected state before continuing.

## Output

Report each step as passed or failed with what was seen on screen — for the grouping steps, the
group headers and their counts — and give the path to the recorded video.
