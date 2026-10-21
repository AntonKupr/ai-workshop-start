# Command line
`./skill-atlas scan <GitHub URL | directory>`
`./skill-atlas scan-org <organization | GitHub URL>`: every repository of an organization
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- `also in <paths>` for copies; warnings go to *stderr*
## Organization output
```
JetBrains · 3 repositories · 2 skills
JetBrains/example · 1 skill
commits — Write commit messages…
  https://github.com/JetBrains/example/blob/<commit>/…
JetBrains/tools · 1 skill
…
```
- How many repositories were scanned, and the skills in all of them
- Then each repository **with skills**, sorted by id, printed as `scan` prints it
- Warnings start with the repository's id
