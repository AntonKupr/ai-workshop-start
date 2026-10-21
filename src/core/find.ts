import type { Skill } from './model.ts';

/** A SKILL.md found in a repository, and the name it has until it is parsed. */
export type SkillFile = { path: string; name: string };

/** Where agents keep a repository's own skills. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/**
 * Every file named exactly SKILL.md, named after its directory (a SKILL.md at the
 * root after the repository). Nothing is ignored: copies are collapsed once parsed, by `collapseCopies`.
 */
export function findSkills(paths: string[], repositoryName: string): SkillFile[] {
  return paths
    .filter((path) => path.split('/').at(-1) === 'SKILL.md')
    .sort()
    .map((path) => ({ path, name: path.split('/').at(-2) ?? repositoryName }));
}

/**
 * The same skill, by name, in other agents' folders is one skill: the first path keeps it,
 * the others are its copies, in path order. A malformed one (its path in `malformed`) is never the first:
 * its name is only its directory's. The same name twice in one agent's folder, or outside them, is two skills.
 */
export function collapseCopies(skills: Skill[], malformed: ReadonlySet<string> = new Set()): Skill[] {
  const result: Skill[] = [];
  const groups = new Map<string, { skill: Skill; roots: Set<string> }[]>();
  const rank = (skill: Skill) => (malformed.has(skill.path) ? 1 : 0);
  const ordered = [...skills].sort((a, b) => rank(a) - rank(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const skill of ordered) {
    const root = SKILL_ROOTS.find((candidate) => skill.path.startsWith(`${candidate}/`));
    if (!root) {
      result.push(skill);
      continue;
    }
    const named = groups.get(skill.name) ?? [];
    groups.set(skill.name, named);
    const group = named.find((candidate) => !candidate.roots.has(root));
    if (group) {
      group.skill.copies.push(skill.path);
      group.skill.copies.sort();
      group.roots.add(root);
    } else {
      const primary = { ...skill, copies: [...skill.copies] };
      named.push({ skill: primary, roots: new Set([root]) });
      result.push(primary);
    }
  }
  return result;
}
