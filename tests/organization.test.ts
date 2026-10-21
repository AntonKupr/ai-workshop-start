// The decisions in spec/analysis.md and spec/cli.md about an organization, checked on what the
// real command prints for the GitHub organization answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openGitHubOrganization } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
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

test('with a token: a fork, which code search leaves out, through its tree; an archived repository through the search; warnings start with the repository id', async () => {
  const FORK = '1111111111111111111111111111111111111111';
  const ARCHIVED = '2222222222222222222222222222222222222222';
  const recording = {
    'https://api.github.com/orgs/Kotlin': { status: 200, body: { login: 'Kotlin' } },
    'https://api.github.com/orgs/Kotlin/repos?per_page=100&page=1': {
      status: 200,
      body: [
        { full_name: 'Kotlin/fork', fork: true, archived: false },
        { full_name: 'Kotlin/old', fork: false, archived: true },
        { full_name: 'Kotlin/plain', fork: false, archived: false },
      ],
    },
    'https://api.github.com/search/code?q=filename:SKILL.md+org:Kotlin&per_page=100&page=1': {
      status: 200,
      body: { total_count: 1, items: [{ path: 'skills/old/SKILL.md', repository: { full_name: 'Kotlin/old' } }] },
    },
    'https://api.github.com/repos/Kotlin/fork': { status: 200, body: { full_name: 'Kotlin/fork', default_branch: 'main' } },
    'https://api.github.com/repos/Kotlin/fork/commits/main': { status: 200, body: { sha: FORK } },
    [`https://api.github.com/repos/Kotlin/fork/git/trees/${FORK}?recursive=1`]: {
      status: 200,
      body: {
        truncated: false,
        tree: [
          { path: '.agents/skills/forked/SKILL.md', mode: '100644', type: 'blob', sha: '1' },
          { path: '.agents/skills/broken/SKILL.md', mode: '100644', type: 'blob', sha: '2' },
        ],
      },
    },
    [`https://raw.githubusercontent.com/Kotlin/fork/${FORK}/.agents/skills/forked/SKILL.md`]: {
      status: 200,
      body: '---\nname: forked\ndescription: From a fork.\n---\n',
    },
    [`https://raw.githubusercontent.com/Kotlin/fork/${FORK}/.agents/skills/broken/SKILL.md`]: {
      status: 200,
      body: '---\nname: [broken\n---\n',
    },
    'https://api.github.com/repos/Kotlin/old': { status: 200, body: { full_name: 'Kotlin/old', default_branch: 'main' } },
    'https://api.github.com/repos/Kotlin/old/commits/main': { status: 200, body: { sha: ARCHIVED } },
    [`https://raw.githubusercontent.com/Kotlin/old/${ARCHIVED}/skills/old/SKILL.md`]: {
      status: 200,
      body: '---\nname: old\ndescription: From an archived repository.\n---\n',
    },
  };
  // Kotlin/plain has no hit, so it is not opened: the replay fails any request for it.
  const result = await scanOrganization(await openGitHubOrganization('Kotlin', { fetch: replay(recording), token: 'test' }));
  assert.equal(result.repositories, 3);
  assert.deepEqual(
    result.results.map(({ repository, skills }) => [repository.id, skills.map((skill) => skill.name)]),
    [
      ['Kotlin/fork', ['broken', 'forked']],
      ['Kotlin/old', ['old']],
    ],
  );
  // A skill's warning starts with its repository's id.
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /^Kotlin\/fork: \.agents\/skills\/broken\/SKILL\.md: malformed front matter: .*; using the directory name$/);
});

test('with a token: more SKILL.md files than code search returns → each repository through its tree, and a warning', async () => {
  const COMMIT = '3333333333333333333333333333333333333333';
  // Ten full pages, all in Kotlin/many: the 1001st file, in Kotlin/late, is not returned.
  const items = Array.from({ length: 100 }, (_, index) => ({ path: `skills/s${index}/SKILL.md`, repository: { full_name: 'Kotlin/many' } }));
  const recording: Recording = {
    'https://api.github.com/orgs/Kotlin': { status: 200, body: { login: 'Kotlin' } },
    'https://api.github.com/orgs/Kotlin/repos?per_page=100&page=1': { status: 200, body: [{ full_name: 'Kotlin/late' }] },
    'https://api.github.com/repos/Kotlin/late': { status: 200, body: { full_name: 'Kotlin/late', default_branch: 'main' } },
    'https://api.github.com/repos/Kotlin/late/commits/main': { status: 200, body: { sha: COMMIT } },
    [`https://api.github.com/repos/Kotlin/late/git/trees/${COMMIT}?recursive=1`]: {
      status: 200,
      body: { truncated: false, tree: [{ path: 'skills/late/SKILL.md', mode: '100644', type: 'blob', sha: '1' }] },
    },
    [`https://raw.githubusercontent.com/Kotlin/late/${COMMIT}/skills/late/SKILL.md`]: {
      status: 200,
      body: '---\nname: late\ndescription: Not in the first thousand.\n---\n',
    },
  };
  for (let page = 1; page <= 10; page++) {
    recording[`https://api.github.com/search/code?q=filename:SKILL.md+org:Kotlin&per_page=100&page=${page}`] = {
      status: 200,
      body: { total_count: 1001, items },
    };
  }
  const result = await scanOrganization(await openGitHubOrganization('Kotlin', { fetch: replay(recording), token: 'test' }));
  assert.deepEqual(
    result.results.map(({ repository, skills }) => [repository.id, skills.map((skill) => skill.name)]),
    [['Kotlin/late', ['late']]],
  );
  assert.deepEqual(result.warnings, [
    'code search found 1001 SKILL.md files and returns only 1000; each repository is read through its tree',
  ]);
});
