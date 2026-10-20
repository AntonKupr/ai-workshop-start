---
name: demo-recorder
description: Record a short browser demo of the web view's filter feature in the demo VM
---

# Demo recorder

## Scope

Use when asked to record a demo of the skill list filter described in `spec/web.md`.

## Setup

1. Start the VM from the `template-vm` template in `.junie/vms/`; the project root is mounted at
   `/workspace` and recording starts with the VM.
2. From `/workspace`: `npm ci && npm run build` — the page is built into `dist/`, which is
   gitignored, so it must be built inside the VM.
3. Start the server in the background: `./skill-atlas web`. It listens on `127.0.0.1:4173` and
   answers `/` with 503 until `dist/web` exists, so wait for a 200 rather than the log line.
4. Open the page: `chromium --no-sandbox --disable-gpu --window-size=1100,700 http://localhost:4173`.

## Steps to record

1. Scan the bundled fixture: type `/workspace/fixture` in the field at the top and press Enter.
   The header shows `<owner>/<repo> · N skills` and the first skill is selected.
2. Narrow the list: type `commits` in the filter field above the list; only the matching skill stays
   and the detail pane follows it.
3. Clear the filter with the field's clear control; the full list comes back.
4. Show case-insensitive matching: type `COMMITS` and confirm the lowercase `commits` skill matches.
5. Optionally type a filter that matches nothing and show `No skills match “<filter>”`.
6. Stop the VM to finish the recording.

## Rules

- Scan the local `fixture` directory, not a GitHub repository: `GITHUB_TOKEN` is not set, so GitHub
  scans share the anonymous rate limit of about 60 requests an hour.
- The fixture's malformed front matter warning banner is expected and does not block filtering.
- Take a screenshot after every interaction and confirm the expected state before continuing.

## Output

Report each step as passed or failed with what was seen on screen, and give the path to the
recorded video.
