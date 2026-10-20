// What the user asked to scan, the way the Node clients open it: a GitHub URL through the
// GitHub API, anything else as a local directory.
import { openGitHub, parseGitHubUrl, type GitHubOptions } from './core/github.ts';
import type { Source } from './core/scan.ts';
import { openDirectory } from './local.ts';

export function opener(github: GitHubOptions): (input: string) => Promise<Source> {
  return (input) => (parseGitHubUrl(input) ? openGitHub(input, github) : openDirectory(input));
}
