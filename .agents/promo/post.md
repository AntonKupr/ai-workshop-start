Skill Atlas: see every agent skill your repository already has.

Skills end up scattered across .agents, .claude, .github and agent folders, copied between them, and nobody knows what the repository already holds.
Point Skill Atlas at a GitHub URL or a local directory and get every SKILL.md with its name, description and a link pinned to the scanned commit.

• It reads the repository through the GitHub API with no clone, in under 5 s for intellij-community.
• Pick a skill in the list and its SKILL.md renders beside it, sanitized so nothing in it runs.
• A filter and the Group by shared words toggle surface the families in your skill names, with copies folded into one skill.

Nothing is stored, the same scan runs in your terminal with ./skill-atlas scan, and GET /api/scan hands the result to your own tools.

$ npm ci && npm run build
$ ./skill-atlas web
Skill Atlas at http://localhost:4173



Grab it from the repository and see your skills in one page today.