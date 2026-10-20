#!/usr/bin/env node
// The Node client: a GitHub repository or organization through the GitHub API, or a local directory; stdout and
// stderr, or the web view. Nothing is stored.
import { run } from './commands.ts';
import { openGitHubOrganization } from './core/github.ts';
import { opener } from './open.ts';
import { startServer } from './web/server.ts';

const token = process.env.GITHUB_TOKEN || undefined;
const open = opener({ fetch, token });
const openOrganization = (input: string) => openGitHubOrganization(input, { fetch, token });

process.exitCode = await run(process.argv.slice(2), {
  open,
  openOrganization,
  print: (text) => console.log(text),
  error: (text) => console.error(text),
  serve: async (port) => (await startServer({ port, open, openOrganization })).url,
});
