// The filter above the list: spec/web.md.
import type { WebSkill } from './api.ts';

/** The skills whose name or description contains the filter, in any case. */
export function matching(skills: WebSkill[], filter: string): WebSkill[] {
  const text = filter.trim().toLowerCase();
  if (!text) return skills;
  return skills.filter((skill) => `${skill.name}\n${skill.description}`.toLowerCase().includes(text));
}
