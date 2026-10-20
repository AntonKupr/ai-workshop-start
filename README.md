# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests; the page's tests need
Chromium, `npx playwright install chromium`.

The same in a web page, built with [Ring UI](https://github.com/JetBrains/ring-ui): a field for the
repository, its skills, and each SKILL.md rendered.

```console
$ npm run build
$ ./skill-atlas web
Skill Atlas at http://localhost:4173
```

- [spec/](spec/): what it does; [spec/web.md](spec/web.md) for the web view. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
