# Web view
`./skill-atlas web [--port <n>]`: the page at `http://localhost:<n>`, *4173* by default.
The same scan as the CLI, in Node: `GITHUB_TOKEN`, GitHub URLs and local directories.
Built with **JetBrains Ring UI**; `npm run build` first. *Nothing is stored*.
## Page
- A **field** for a GitHub URL or a directory; *Scan* or Enter scans
- `<owner>/<repo> · N skills`, then the **list**: sorted by **name**,
  the description's *first sentence*, `also in <paths>` for copies
- The selected skill's **SKILL.md**: name, description, the other front matter,
  the body **rendered as Markdown**, the link pinned to the *scanned commit*
- The first skill is selected after a scan; a click selects another
- A **filter** field above the list: only the skills whose name or description contains it,
  *in any case*; none → `No skills match “<filter>”`. The header still counts every skill.
  A skill the filter hides is no longer selected: the *first match* is. A scan clears the filter
- Warnings in a *warning* banner; an unreachable repository → the CLI's message,
  in an *error* banner
- A SKILL.md comes from anyone: its HTML is *sanitized*, nothing in it runs
## API
`GET /api/scan?input=<GitHub URL | directory>` → `{ repository, skills, warnings }`;
each skill with its `link` and `summary`. A clear message → `400 { error }`.
