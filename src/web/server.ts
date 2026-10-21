// The web view's server: the page, built into dist/web, and two calls, GET /api/scan?input=<GitHub
// URL | directory> and GET /api/scan-organization?organization=<name | GitHub URL>, which scan the
// way the CLI does. Nothing is stored.
import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AtlasError } from '../core/errors.ts';
import { firstSentence, skillLink, type Repository, type Skill } from '../core/model.ts';
import { scan, scanOrganization, type OrganizationSource, type Source } from '../core/scan.ts';

export type ServerOptions = {
  /** 0 for any free port. */
  port: number;
  /** Opens what the user asked to scan. */
  open(input: string): Promise<Source>;
  /** Opens the GitHub organization the user asked to scan. */
  openOrganization(input: string): Promise<OrganizationSource>;
  /** The built page; dist/web by default. */
  page?: string;
};

const PAGE = fileURLToPath(new URL('../../dist/web', import.meta.url));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/** Listens on localhost; its address and how to stop it. */
export async function startServer({ port, open, openOrganization, page = PAGE }: ServerOptions) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/api/scan') await scanRequest(url.searchParams.get('input') ?? '', open, response);
      else if (url.pathname === '/api/scan-organization') {
        await scanOrganizationRequest(url.searchParams.get('organization') ?? '', openOrganization, response);
      }
      else await pageRequest(page, url.pathname, response);
    } catch (error) {
      send(response, 500, 'application/json', JSON.stringify({ error: `Unexpected error: ${describe(error)}` }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // localhost resolves to 127.0.0.1 first, for Node's fetch and for browsers.
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: `http://localhost:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** The repository, each skill with its link and first sentence, and the warnings; or the error. */
async function scanRequest(input: string, open: ServerOptions['open'], response: ServerResponse) {
  try {
    if (!input.trim()) throw new AtlasError('Enter a GitHub URL or a directory');
    const { repository, skills, warnings } = await scan(await open(input.trim()));
    send(response, 200, 'application/json', JSON.stringify({ repository, skills: webSkills(repository, skills), warnings }));
  } catch (error) {
    if (!(error instanceof AtlasError)) throw error;
    send(response, 400, 'application/json', JSON.stringify({ error: error.message }));
  }
}

/** How many repositories were scanned, each one with skills and its skills, and the warnings; or the error. */
async function scanOrganizationRequest(input: string, open: ServerOptions['openOrganization'], response: ServerResponse) {
  try {
    if (!input.trim()) throw new AtlasError('Enter a GitHub organization');
    const { organization, repositories, results, warnings } = await scanOrganization(await open(input.trim()));
    const body = {
      organization,
      repositories,
      results: results.map(({ repository, skills }) => ({ repository, skills: webSkills(repository, skills) })),
      warnings,
    };
    send(response, 200, 'application/json', JSON.stringify(body));
  } catch (error) {
    if (!(error instanceof AtlasError)) throw error;
    send(response, 400, 'application/json', JSON.stringify({ error: error.message }));
  }
}

/** Each skill with its link and first sentence. */
function webSkills(repository: Repository, skills: Skill[]) {
  return skills.map((skill) => ({ ...skill, link: skillLink(repository, skill), summary: firstSentence(skill.description) }));
}

/** A file of the built page; index.html for anything else. */
async function pageRequest(page: string, pathname: string, response: ServerResponse) {
  // The path starts at /, so it cannot go above the page.
  const path = normalize(decodeURIComponent(pathname));
  const file = extname(path) ? join(page, path) : join(page, 'index.html');
  const bytes = await readFile(file).catch(() => undefined);
  if (bytes) return send(response, 200, TYPES[extname(file)] ?? 'application/octet-stream', bytes);
  if (extname(path)) return send(response, 404, 'text/plain; charset=utf-8', 'Not found');
  send(response, 503, 'text/plain; charset=utf-8', 'The web view is not built: run npm run build');
}

function send(response: ServerResponse, status: number, type: string, body: string | Uint8Array) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
