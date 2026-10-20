// The decisions in spec/analysis.md and spec/cli.md about an organization, checked on what the
// real command prints for the GitHub organization answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openGitHubOrganization } from '../src/core/github.ts';
import { replay } from '../src/core/replay.ts';
import { scanOrganization } from '../src/core/scan.ts';
import { atlas, EXAMPLE_COMMIT, TOOLS_COMMIT } from './helpers.ts';

test('scan-org prints the repositories with skills, sorted by id, and warns about the one that does not answer', async () => {
  for (const input of ['JetBrains', 'https://github.com/JetBrains', 'github.com/JetBrains/']) {
    const scanned = await atlas(['scan-org', input]);
    assert.equal(scanned.code, 0, scanned.stderr);
    assert.equal(
      scanned.stdout,
      [
        'JetBrains · 4 repositories · 2 skills',
        'JetBrains/example · 1 skill',
        'commits — Write commit messages the way this repository does.',
        `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
        'JetBrains/tools · 1 skill',
        'release — Cut a release.',
        `  https://github.com/JetBrains/tools/blob/${TOOLS_COMMIT}/skills/release/SKILL.md`,
      ].join('\n'),
    );
    assert.equal(
      scanned.stderr,
      'warning: JetBrains/not-answered: Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered',
    );
  }
});

test('without a token: every repository through its tree, across pages', async () => {
  const COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';
  const page = (from: number, count: number) => Array.from({ length: count }, (_, index) => ({ full_name: `Kotlin/r${from + index}` }));
  const recording = {
    'https://api.github.com/orgs/kotlin': { status: 200, body: { login: 'Kotlin' } },
    'https://api.github.com/orgs/Kotlin/repos?per_page=100&page=1': { status: 200, body: page(0, 100) },
    'https://api.github.com/orgs/Kotlin/repos?per_page=100&page=2': { status: 200, body: page(100, 1) },
    'https://api.github.com/repos/Kotlin/r100': { status: 200, body: { full_name: 'Kotlin/r100', default_branch: 'main' } },
    'https://api.github.com/repos/Kotlin/r100/commits/main': { status: 200, body: { sha: COMMIT } },
    [`https://api.github.com/repos/Kotlin/r100/git/trees/${COMMIT}?recursive=1`]: {
      status: 200,
      body: { truncated: false, tree: [{ path: '.agents/skills/build/SKILL.md', mode: '100644', type: 'blob', sha: '1' }] },
    },
    [`https://raw.githubusercontent.com/Kotlin/r100/${COMMIT}/.agents/skills/build/SKILL.md`]: {
      status: 200,
      body: '---\nname: build\ndescription: Build it.\n---\n',
    },
  };
  // The other 100 repositories are empty, as GitHub answers for a repository without commits.
  const empty = (url: string) =>
    Promise.resolve(
      /\/repos\/Kotlin\/r\d+$/.test(url)
        ? Response.json({ full_name: url.split('/repos/')[1], default_branch: 'main' })
        : Response.json({ message: 'Git Repository is empty.' }, { status: 409 }),
    );
  const result = await scanOrganization(await openGitHubOrganization('kotlin', { fetch: replay(recording, empty) }));
  assert.deepEqual(result.organization, { id: 'Kotlin', url: 'https://github.com/Kotlin' });
  assert.equal(result.repositories, 101);
  assert.deepEqual(
    result.results.map(({ repository, skills }) => [repository.id, skills.map((skill) => skill.name)]),
    [['Kotlin/r100', ['build']]],
  );
  assert.equal(result.warnings.length, 100);
  assert.match(result.warnings[0], /^Kotlin\/r0: GitHub answered 409 for .*: Git Repository is empty\.$/);
});

test('unknown organization → a clear message, exit code 1', async () => {
  const notFound = replay({ 'https://api.github.com/orgs/no-such-organization': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHubOrganization('no-such-organization', { fetch: notFound }), {
    message: 'Organization not found: https://github.com/no-such-organization',
  });

  const wrong = await atlas(['scan-org', 'https://github.com/JetBrains/example']);
  assert.equal(wrong.code, 1);
  assert.equal(wrong.stderr, 'Not a GitHub organization: https://github.com/JetBrains/example');

  assert.equal((await atlas(['scan-org'])).stderr, 'Usage: skill-atlas scan-org <organization | GitHub URL>');
  assert.match((await atlas(['help'])).stdout, /^ {2}scan-org <organization \| GitHub URL> +every repository/m);
});

test('the rate limit stops the whole scan', async () => {
  const limited = replay({
    'https://api.github.com/orgs/JetBrains': { status: 200, body: { login: 'JetBrains' } },
    'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': { status: 200, body: [{ full_name: 'JetBrains/MPS' }] },
    'https://api.github.com/repos/JetBrains/MPS': { status: 403, body: { message: 'API rate limit exceeded for 192.0.2.1.' } },
  });
  await assert.rejects(scanOrganization(await openGitHubOrganization('JetBrains', { fetch: limited })), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});
