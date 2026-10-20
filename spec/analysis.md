# Repository analysis
## Input
A **GitHub repository** URL, or a local directory;
or a **GitHub organization**: every repository in it
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI and web view: *thin clients*.
Skill: id = `repo:path`, name, description, commit;
its other front matter and its *body*, the Markdown after it
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
## Organization
- `<name>` or `https://github.com/<name>`; every repository, *archived and forks* too
- With `GITHUB_TOKEN`: *one* code search for the organization; a repository without a hit
  is not opened. A *fork*, which code search leaves out, is read through its tree.
  Without it: each repository's tree
- A repository that cannot be scanned → a *warning*, the scan goes on;
  the rate limit stops it
- Unknown organization → a clear message, exit code 1
