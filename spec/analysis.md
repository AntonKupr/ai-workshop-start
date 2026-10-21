# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI and web view: *thin clients*.
Skill: id = `repo:path`, name, description, commit;
its other front matter and its *body*, the Markdown after it
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- Copies: the same name in *another agent's folder* (`.agents`, `.claude`, `.github`, `agent` `/skills`)
  → *one* skill, at the first path; the others are its `copies`. The same name in one folder,
  or outside them, is another skill
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
