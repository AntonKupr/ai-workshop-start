# Web view
`./skill-atlas web [--port <n>]`: the page at `http://localhost:<n>`, *4173* by default.
The same scan as the CLI, in Node: `GITHUB_TOKEN`, GitHub URLs and local directories.
Built with **JetBrains Ring UI**; `npm run build` first. *Nothing is stored*.
## Page
- A **field** for a GitHub URL or a directory; *Scan* or Enter scans
- `<owner>/<repo> · N skills`, then the **list**: sorted by **name**,
  the description's *first sentence*, `also in <paths>` for copies
- The **list** beside the SKILL.md, *within the window* before and after the page scrolls:
  it scrolls on its own, the filter stays on top, as wide as the list; a *divider* between skills,
  the selected one *marked* on its left, each description's first sentence in *two lines* at most
- The selected skill's **SKILL.md**: name, description, the other front matter,
  the body **rendered as Markdown**, the link pinned to the *scanned commit*
- A second **field** for a GitHub organization; *Look up* or Enter scans every repository:
  `<organization> · N repositories · M skills`, then the skills of each repository
  with skills, under its `<owner>/<repo>`, sorted by id. The filter and the groups apply
  inside each repository, as they do for one; a repository with no match is hidden
- The first skill *as the list shows it*, grouped or not, is selected after a scan; a click
  selects another
- A **filter** field above the list: only the skills whose name or description contains it,
  *in any case*, the spaces around it ignored; the *whole* description, not only the first
  sentence the list shows; none → `No skills match “<filter>”`. The header still counts every skill.
  A skill the filter hides is no longer selected: the *first match* in the list is. A scan clears
  the filter
- A **Group by shared words** toggle under the filter, *off* by default, kept across scans: the list
  in groups by a word the skills' **names** share (split at `-`, `_`, `.` and spaces, in any case,
  two letters or more). The word the most skills share makes a group, then the next among the rest,
  while a word joins *at least two*; a tie → the first word alphabetically. Groups sorted by word,
  `Other` last for the rest; by name inside a group. A group's header, `<word> · N`, collapses and
  expands it; a scan expands every group. The filter applies inside the groups, over every skill:
  `N` counts the matches, a group with none is hidden
- Warnings in a *warning* banner; an unreachable repository → the CLI's message,
  in an *error* banner
- A SKILL.md comes from anyone: its HTML is *sanitized*, nothing in it runs
## API
`GET /api/scan?input=<GitHub URL | directory>` → `{ repository, skills, warnings }`;
each skill with its `link` and `summary`. A clear message → `400 { error }`.
`GET /api/scan-organization?organization=<name | GitHub URL>` →
`{ organization, repositories, results, warnings }`: `repositories`, how many were scanned;
`results`, each repository with skills and its skills, as above. A clear message → `400 { error }`.
