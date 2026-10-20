// What GET /api/scan answers: src/web/server.ts.
import type { Repository, Skill } from '../src/core/model.ts';

export type WebSkill = Skill & { link: string; summary: string };
export type WebScan = { repository: Repository; skills: WebSkill[]; warnings: string[] };

/** The scan, or the server's message for why there is none. */
export async function scanRepository(input: string): Promise<WebScan> {
  const response = await fetch(`/api/scan?input=${encodeURIComponent(input)}`);
  const body = (await response.json().catch(() => ({}))) as WebScan & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The server answered ${response.status}`);
  return body;
}
