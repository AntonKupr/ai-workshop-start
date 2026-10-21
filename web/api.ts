// What GET /api/scan and GET /api/scan-organization answer: src/web/server.ts.
import type { Organization, Repository, Skill } from '../src/core/model.ts';

export type WebSkill = Skill & { link: string; summary: string };
export type WebScan = { repository: Repository; skills: WebSkill[]; warnings: string[] };
export type WebOrganizationScan = {
  organization: Organization;
  /** How many repositories were scanned. */
  repositories: number;
  /** Each repository with skills. */
  results: { repository: Repository; skills: WebSkill[] }[];
  warnings: string[];
};

/** The scan, or the server's message for why there is none. */
export function scanRepository(input: string): Promise<WebScan> {
  return get(`/api/scan?input=${encodeURIComponent(input)}`);
}

/** Every repository of the organization, or the server's message for why there is none. */
export function scanOrganization(organization: string): Promise<WebOrganizationScan> {
  return get(`/api/scan-organization?organization=${encodeURIComponent(organization)}`);
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The server answered ${response.status}`);
  return body;
}
