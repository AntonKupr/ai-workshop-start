// spec/web.md: the web view's server, `./skill-atlas web` and GET /api/scan, for ./fixture and the
// GitHub repository answered in tests/helpers.ts. The page itself: tests/web.spec.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { startServer } from '../src/web/server.ts';
import type { WebOrganizationScan, WebScan } from '../web/api.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE, open, openOrganization, TOOLS_COMMIT } from './helpers.ts';

let server: Awaited<ReturnType<typeof startServer>>;
let page: string;
before(async () => {
  page = mkdtempSync(join(tmpdir(), 'skill-atlas-page-'));
  server = await startServer({ port: 0, open, openOrganization, page });
});
after(async () => {
  await server.close();
  rmSync(page, { recursive: true, force: true });
});

async function scan(input: string) {
  const response = await fetch(`${server.url}/api/scan?input=${encodeURIComponent(input)}`);
  return { status: response.status, body: (await response.json()) as WebScan & { error: string } };
}

test('GET /api/scan: the repository, each skill with its body, pinned link and first sentence', async () => {
  const { status, body } = await scan('https://github.com/JetBrains/example');
  assert.equal(status, 200);
  assert.equal(body.repository.id, 'JetBrains/example');
  assert.deepEqual(body.warnings, []);
  assert.equal(body.skills.length, 1);
  const [skill] = body.skills;
  assert.equal(skill.name, 'commits');
  assert.equal(skill.summary, 'Write commit messages the way this repository does.');
  assert.equal(skill.description, 'Write commit messages the way this repository does. Use for every commit.');
  assert.equal(skill.link, `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`);
  assert.equal(skill.commit, EXAMPLE_COMMIT);
  assert.equal(skill.body, '# Commits');
  assert.deepEqual(skill.properties, {});
});

test('GET /api/scan of ./fixture: sorted by name, linked to the files, the malformed one warned about', async () => {
  const { status, body } = await scan(FIXTURE);
  assert.equal(status, 200);
  assert.deepEqual(
    body.skills.map((skill) => [skill.name, skill.link]),
    [
      ['code-style', `${pathToFileURL(FIXTURE).href}/.github/skills/code-style/SKILL.md`],
      ['commits', `${pathToFileURL(FIXTURE).href}/.claude/skills/commits/SKILL.md`],
      ['release-checklist', `${pathToFileURL(FIXTURE).href}/.agents/skills/release-checklist/SKILL.md`],
    ],
  );
  assert.equal(body.warnings.length, 1);
  assert.match(body.warnings[0], /^\.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('GET /api/scan: the same skill in other agents\' folders → one skill with its copies', async (t) => {
  const repository = mkdtempSync(join(tmpdir(), 'skill-atlas-copies-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  for (const path of ['.claude/skills/commits', '.github/skills/commits', '.agents/skills/alpha']) {
    mkdirSync(join(repository, path), { recursive: true });
    writeFileSync(join(repository, path, 'SKILL.md'), `---\nname: ${path.split('/').at(-1)}\ndescription: The skill.\n---\n`);
  }
  const { status, body } = await scan(repository);
  assert.equal(status, 200);
  assert.deepEqual(
    body.skills.map((skill) => [skill.name, skill.path, skill.copies]),
    [
      ['alpha', '.agents/skills/alpha/SKILL.md', []],
      ['commits', '.claude/skills/commits/SKILL.md', ['.github/skills/commits/SKILL.md']],
    ],
  );
});

test('GET /api/scan: an unreachable repository → 400 and the CLI message', async () => {
  const missing = await scan(join(FIXTURE, 'no-such-directory'));
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /^Not a GitHub URL or a readable directory: .*no-such-directory$/);

  const offline = await scan('https://github.com/JetBrains/not-answered');
  assert.equal(offline.status, 400);
  assert.equal(offline.body.error, (await atlas(['scan', 'https://github.com/JetBrains/not-answered'])).stderr);

  const empty = await scan(' ');
  assert.deepEqual(empty, { status: 400, body: { error: 'Enter a GitHub URL or a directory' } });
});

async function scanOrganization(organization: string) {
  const response = await fetch(`${server.url}/api/scan-organization?organization=${encodeURIComponent(organization)}`);
  return { status: response.status, body: (await response.json()) as WebOrganizationScan & { error: string } };
}

test('GET /api/scan-organization: how many repositories, each one with skills, its skills linked, and the warnings', async () => {
  const { status, body } = await scanOrganization(' https://github.com/JetBrains ');
  assert.equal(status, 200);
  assert.deepEqual(body.organization, { id: 'JetBrains', url: 'https://github.com/JetBrains' });
  assert.equal(body.repositories, 4);
  assert.deepEqual(
    body.results.map(({ repository, skills }) => [repository.id, skills.map((skill) => [skill.name, skill.summary, skill.link])]),
    [
      [
        'JetBrains/example',
        [['commits', 'Write commit messages the way this repository does.', `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]],
      ],
      ['JetBrains/tools', [['release', 'Cut a release.', `https://github.com/JetBrains/tools/blob/${TOOLS_COMMIT}/skills/release/SKILL.md`]]],
    ],
  );
  assert.equal(body.results[1].skills[0].body, '# Release');
  assert.deepEqual(body.warnings, [(await atlas(['scan-org', 'JetBrains'])).stderr.replace(/^warning: /, '')]);
});

test('GET /api/scan-organization: a clear message → 400', async () => {
  assert.deepEqual(await scanOrganization(' '), { status: 400, body: { error: 'Enter a GitHub organization' } });
  assert.deepEqual(await scanOrganization('a/b/c'), { status: 400, body: { error: 'Not a GitHub organization: a/b/c' } });
  const offline = await scanOrganization('not-answered');
  assert.equal(offline.status, 400);
  assert.equal(offline.body.error, 'Cannot reach GitHub: not recorded: https://api.github.com/orgs/not-answered');
});

test('the page: index.html, or a message to build it', async (t) => {
  const missing = await fetch(server.url);
  assert.equal(missing.status, 503);
  assert.equal(await missing.text(), 'The web view is not built: run npm run build');

  const built = mkdtempSync(join(tmpdir(), 'skill-atlas-built-'));
  t.after(() => rmSync(built, { recursive: true, force: true }));
  mkdirSync(join(built, 'page'));
  writeFileSync(join(built, 'page/index.html'), '<title>Skill Atlas</title>');
  writeFileSync(join(built, 'secret.txt'), 'not part of the page');
  const other = await startServer({ port: 0, open, openOrganization, page: join(built, 'page') });
  t.after(() => other.close());
  const index = await fetch(other.url);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(await index.text(), '<title>Skill Atlas</title>');
  assert.equal((await fetch(`${other.url}/assets/missing.js`)).status, 404);
  // An encoded / survives URL parsing; the path still stays inside the page.
  assert.equal((await fetch(`${other.url}/..%2fsecret.txt`)).status, 404);
});

test('./skill-atlas web prints its address, scans, and stores nothing', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const child = spawn(process.execPath, [CLI, 'web', '--port', '0'], { cwd });
  t.after(() => child.kill());
  const url = await new Promise<string>((resolve, reject) => {
    child.stdout.setEncoding('utf8').on('data', (text: string) => {
      const match = /^Skill Atlas at (http:\/\/localhost:\d+)$/m.exec(text);
      if (match) resolve(match[1]);
    });
    child.once('exit', (code) => reject(new Error(`exited with ${code}`)));
  });
  const response = await fetch(`${url}/api/scan?input=${encodeURIComponent(FIXTURE)}`);
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as WebScan).skills.length, 3);
  assert.deepEqual(readdirSync(cwd), []);
});

test('web: usage for a wrong port, and the help lists it', async () => {
  const wrong = await atlas(['web', '--port', 'x']);
  assert.equal(wrong.code, 1);
  assert.equal(wrong.stderr, 'Usage: skill-atlas web [--port <n>]');
  assert.match((await atlas(['help'])).stdout, /^ {2}web \[--port <n>\] +the same in a web page/m);
  // Without a server to start, as in the browser terminal.
  assert.equal((await atlas(['web'])).stderr, 'skill-atlas web is not available here');
});
