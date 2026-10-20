// The decisions in spec/analysis.md and spec/cli.md, checked on what the real command prints for
// ./fixture, for a small GitHub repository answered in tests/helpers.ts, and for throwaway
// repositories laid out for the edge cases of where a project skill lives.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { openGitHub } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay } from '../src/core/replay.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE, repository, skillFile } from './helpers.ts';

/** Scans a throwaway repository with the given files and returns what the command printed. */
async function scanFiles(t: TestContext, files: Record<string, string>) {
  const root = repository(t, files);
  return { ...(await atlas(['scan', root])), id: basename(root), url: pathToFileURL(root).href };
}

const fixture = await atlas(['scan', FIXTURE]);
const example = await atlas(['scan', 'github.com/JetBrains/example']);

test('malformed front matter → the directory name, no description and a warning', () => {
  const parsed = parseSkill(readFileSync(join(FIXTURE, '.agents/skills/release-checklist/SKILL.md'), 'utf8'));
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, '');
  assert.equal(
    parsed.warning,
    'malformed front matter: Nested mappings are not allowed in compact mappings at line 3, column 14; using the directory name',
  );
});

test('scan prints the repository, then each skill with its first sentence and pinned link', () => {
  assert.equal(example.code, 0, example.stderr);
  assert.equal(
    example.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
});

test('./fixture: every skill, sorted by name, linked to its file, with a warning for the malformed one', () => {
  const root = pathToFileURL(FIXTURE).href;
  assert.equal(fixture.code, 0);
  assert.equal(
    fixture.stdout,
    [
      'fixture · 3 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.claude/skills/commits/SKILL.md`,
      'release-checklist',
      `  ${root}/.agents/skills/release-checklist/SKILL.md`,
    ].join('\n'),
  );
  assert.match(fixture.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('the CLI prints the result at once and stores nothing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const scanned = spawnSync(process.execPath, [CLI, 'scan', FIXTURE], { cwd, encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${fixture.stdout}\n`);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unreachable repository → a clear message, exit code 1', async () => {
  const missing = spawnSync(process.execPath, [CLI, 'scan', join(FIXTURE, 'no-such-directory')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^Not a GitHub URL or a readable directory: .*no-such-directory\n$/);

  // What GitHub answers for a repository that does not exist.
  const notFound = replay({ 'https://api.github.com/repos/JetBrains/no-such-repository': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHub('https://github.com/JetBrains/no-such-repository', { fetch: notFound }), {
    message: 'Repository not found: https://github.com/JetBrains/no-such-repository',
  });

  const offline = await atlas(['scan', 'https://github.com/JetBrains/not-answered']);
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /^Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered$/);
});

test('a skill is exactly <root>/<name>/SKILL.md; anything else is not, and says nothing', async (t) => {
  const scanned = await scanFiles(t, {
    '.agents/skills/ok/SKILL.md': skillFile('ok'),
    // Not under a skill root at all.
    'SKILL.md': skillFile('at-the-repository-root'),
    'docs/SKILL.md': skillFile('docs'),
    // A root nested in the repository is not the repository's own root.
    'packages/app/.claude/skills/nested-root/SKILL.md': skillFile('nested-root'),
    // Near-miss roots.
    '.agents/skill/singular/SKILL.md': skillFile('singular'),
    '.github/skills-extra/extra/SKILL.md': skillFile('extra'),
    'agents/skills/no-dot/SKILL.md': skillFile('no-dot'),
    // No <name>, or more than one level of it.
    '.agents/skills/SKILL.md': skillFile('right-in-the-root'),
    '.claude/skills/deep/nested/SKILL.md': skillFile('deep'),
    // Near-miss file names.
    '.claude/skills/lower/skill.md': skillFile('lower'),
    '.github/skills/backup/SKILL.md.bak': skillFile('backup'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(scanned.stdout, [`${scanned.id} · 1 skill`, 'ok — What ok is for.', `  ${scanned.url}/.agents/skills/ok/SKILL.md`].join('\n'));
  assert.equal(scanned.stderr, '');
});

test('every root counts, and a skill in each is a skill of its own', async (t) => {
  const scanned = await scanFiles(t, {
    '.agents/skills/agents/SKILL.md': skillFile('agents'),
    '.claude/skills/claude/SKILL.md': skillFile('claude'),
    '.github/skills/github/SKILL.md': skillFile('github'),
    'agent/skills/agent/SKILL.md': skillFile('agent'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${scanned.id} · 4 skills`,
      'agent — What agent is for.',
      `  ${scanned.url}/agent/skills/agent/SKILL.md`,
      'agents — What agents is for.',
      `  ${scanned.url}/.agents/skills/agents/SKILL.md`,
      'claude — What claude is for.',
      `  ${scanned.url}/.claude/skills/claude/SKILL.md`,
      'github — What github is for.',
      `  ${scanned.url}/.github/skills/github/SKILL.md`,
    ].join('\n'),
  );
});

test('the same name in every root → one skill, under the first root listed, the rest its copies', async (t) => {
  const scanned = await scanFiles(t, {
    'agent/skills/commits/SKILL.md': skillFile('commits'),
    '.github/skills/commits/SKILL.md': skillFile('commits'),
    '.claude/skills/commits/SKILL.md': skillFile('commits'),
    '.agents/skills/commits/SKILL.md': skillFile('commits'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${scanned.id} · 1 skill`,
      'commits — What commits is for.',
      `  ${scanned.url}/.agents/skills/commits/SKILL.md`,
      '  also in .claude/skills/commits/SKILL.md, .github/skills/commits/SKILL.md, agent/skills/commits/SKILL.md',
    ].join('\n'),
  );
});

test('the first root listed that has the skill wins, not the first root there is', async (t) => {
  const scanned = await scanFiles(t, {
    'agent/skills/commits/SKILL.md': skillFile('commits'),
    '.github/skills/commits/SKILL.md': skillFile('commits'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${scanned.id} · 1 skill`,
      'commits — What commits is for.',
      `  ${scanned.url}/.github/skills/commits/SKILL.md`,
      '  also in agent/skills/commits/SKILL.md',
    ].join('\n'),
  );
});

test('the name is compared exactly: Commits and commits are two skills', async (t) => {
  const scanned = await scanFiles(t, {
    '.agents/skills/Commits/SKILL.md': skillFile('Commits'),
    '.claude/skills/commits/SKILL.md': skillFile('commits'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${scanned.id} · 2 skills`,
      'Commits — What Commits is for.',
      `  ${scanned.url}/.agents/skills/Commits/SKILL.md`,
      'commits — What commits is for.',
      `  ${scanned.url}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
});

test('copies follow the directory, never the front matter name', async (t) => {
  const scanned = await scanFiles(t, {
    '.agents/skills/alpha/SKILL.md': skillFile('shared'),
    '.claude/skills/beta/SKILL.md': skillFile('shared'),
  });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${scanned.id} · 2 skills`,
      'shared — What shared is for.',
      `  ${scanned.url}/.agents/skills/alpha/SKILL.md`,
      'shared — What shared is for.',
      `  ${scanned.url}/.claude/skills/beta/SKILL.md`,
    ].join('\n'),
  );
});

test('a repository with no skill root at all → no skills, and no warning', async (t) => {
  const scanned = await scanFiles(t, { 'README.md': '# Nothing here\n' });
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${scanned.id} · 0 skills`);
  assert.equal(scanned.stderr, '');
});

test('rate limit → a message that asks for GITHUB_TOKEN', async () => {
  const limited = replay({
    'https://api.github.com/repos/JetBrains/MPS': {
      status: 403,
      body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
    },
  });
  await assert.rejects(openGitHub('https://github.com/JetBrains/MPS', { fetch: limited }), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});
