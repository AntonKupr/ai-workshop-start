vm: template-vm

## Running inside the VM

Skill Atlas has no dev server: the page is built with Vite into `dist/`, which is gitignored, so
the build has to run in the VM before the server starts. From `/workspace`:

    npm ci
    npm run build
    ./skill-atlas web &
    # ready when http://localhost:4173 responds 200

The server listens on `127.0.0.1:4173`, which is enough because Chromium runs inside the same VM.
`npm ci` and `npm run build` take a while; wait for the ready signal instead of the log line.

## Driving the page

- The field at the top takes a GitHub URL or a directory; *Scan* or Enter scans.
- A scan selects the first skill; the list is sorted by name, the filter field above it narrows it.
- Useful inputs: `https://github.com/JetBrains/kotlin`, or the bundled `fixture` directory
  (a local path needs no network at all).

## Known quirks

- `GITHUB_TOKEN` is not set, so GitHub scans use the anonymous rate limit (~60 requests an hour).
  Exhausting it shows `GitHub rate limit reached; set GITHUB_TOKEN` in an error banner — keep the
  number of scans of real repositories small, or scan the local `fixture` directory instead.
- Without a token a huge repository can warn that its tree was too large to list at once; the
  warning banner is expected, not a failure.
