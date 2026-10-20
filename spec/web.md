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
- A second **field** for a GitHub organization; *Look up* or Enter scans every repository:
  `<organization> · N repositories · M skills`, then the skills of each repository
  with skills, under its `<owner>/<repo>`, sorted by id
- The first skill is selected after a scan; a click selects another
- Warnings in a *warning* banner; an unreachable repository → the CLI's message,
  in an *error* banner
- A SKILL.md comes from anyone: its HTML is *sanitized*, nothing in it runs
## API
`GET /api/scan?input=<GitHub URL | directory>` → `{ repository, skills, warnings }`;
each skill with its `link` and `summary`. A clear message → `400 { error }`.
`GET /api/scan-organization?organization=<name | GitHub URL>` →
`{ organization, repositories, results, warnings }`: `repositories`, how many were scanned;
`results`, each repository with skills and its skills, as above. A clear message → `400 { error }`.
