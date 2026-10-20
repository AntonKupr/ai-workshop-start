// Runs the commands the way the CLI does, with GitHub answering from EXAMPLE and ORGANIZATION below.
import { fileURLToPath } from 'node:url';
import { run } from '../src/commands.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { openGitHubOrganization } from '../src/core/github.ts';
import { opener } from '../src/open.ts';

export const FIXTURE = fileURLToPath(new URL('../fixture', import.meta.url));
export const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

/** The commit GitHub answers for JetBrains/example. */
export const EXAMPLE_COMMIT = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';

/** What GitHub answers for a small repository, JetBrains/example, with one skill. */
const EXAMPLE: Recording = {
  'https://api.github.com/repos/JetBrains/example': { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/example/commits/main': { status: 200, body: { sha: EXAMPLE_COMMIT } },
  'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/example&per_page=100&page=1': {
    status: 200,
    body: { total_count: 1, items: [{ path: '.claude/skills/commits/SKILL.md' }] },
  },
  [`https://raw.githubusercontent.com/JetBrains/example/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]: {
    status: 200,
    body: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
  },
};

/** The commit GitHub answers for JetBrains/tools. */
export const TOOLS_COMMIT = '0123456789abcdef0123456789abcdef01234567';

/**
 * What GitHub answers for the JetBrains organization: four repositories, and code search finds
 * skills in three. JetBrains/example and JetBrains/tools have one each; JetBrains/not-answered
 * does not answer; JetBrains/docs has none, so it is not opened.
 */
const ORGANIZATION: Recording = {
  'https://api.github.com/orgs/JetBrains': { status: 200, body: { login: 'JetBrains' } },
  'https://api.github.com/orgs/JetBrains/repos?per_page=100&page=1': {
    status: 200,
    body: [
      { full_name: 'JetBrains/tools' },
      { full_name: 'JetBrains/not-answered' },
      { full_name: 'JetBrains/example' },
      { full_name: 'JetBrains/docs' },
    ],
  },
  'https://api.github.com/search/code?q=filename:SKILL.md+org:JetBrains&per_page=100&page=1': {
    status: 200,
    body: {
      total_count: 3,
      items: [
        { path: 'skills/release/SKILL.md', repository: { full_name: 'JetBrains/tools' } },
        { path: '.claude/skills/commits/SKILL.md', repository: { full_name: 'JetBrains/example' } },
        { path: '.claude/skills/x/SKILL.md', repository: { full_name: 'JetBrains/not-answered' } },
      ],
    },
  },
  'https://api.github.com/repos/JetBrains/tools': { status: 200, body: { full_name: 'JetBrains/tools', default_branch: 'master' } },
  'https://api.github.com/repos/JetBrains/tools/commits/master': { status: 200, body: { sha: TOOLS_COMMIT } },
  [`https://raw.githubusercontent.com/JetBrains/tools/${TOOLS_COMMIT}/skills/release/SKILL.md`]: {
    status: 200,
    body: '---\nname: release\ndescription: Cut a release. Tag it first.\n---\n# Release\n',
  },
};

const github = replay({ ...EXAMPLE, ...ORGANIZATION });

/** Opens a GitHub URL or a directory as the CLI does; with a token, through code search, as EXAMPLE answers it. */
export const open = opener({ fetch: github, token: 'test' });

/** Opens a GitHub organization as the CLI does, with a token, as ORGANIZATION answers it. */
export const openOrganization = (input: string) => openGitHubOrganization(input, { fetch: github, token: 'test' });

/** `skill-atlas <args>`, as the CLI runs it, with GitHub answering from EXAMPLE and ORGANIZATION. */
export async function atlas(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(args, {
    open,
    openOrganization,
    print: (text) => stdout.push(text),
    error: (text) => stderr.push(text),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
