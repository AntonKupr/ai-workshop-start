# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
## What is a project skill?
- `<root>/<name>/SKILL.md`, `<root>` is one of:
- `.agents/skills`, `.claude/skills`,
- `.github/skills`, `agent/skills`
- The same `<name>` in two roots → one skill, under the *first root listed*; the rest are its *copies*
- `<name>` is the *directory*, compared exactly: `Commits` and `commits` are two skills
- Anything else → not a skill, *silently*: no warning
- A root *nested* in the repository, `packages/app/.claude/skills/x/SKILL.md`
- A near-miss root, `.agents/skill`, `.github/skills-extra`, `agents/skills`
- `<name>` *missing*, `.agents/skills/SKILL.md`, or *deeper*, `.claude/skills/a/b/SKILL.md`
- A near-miss file, `skill.md`, `SKILL.md.bak`
