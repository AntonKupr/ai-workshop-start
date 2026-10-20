/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills, in the order a skill's own file is picked. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/**
 * Every project skill: `<root>/<name>/SKILL.md`, and nothing else — a root nested in the
 * repository, a deeper or missing `<name>`, a near-miss root or file name are not skills,
 * and go by without a warning. The same `<name>` under several roots is one skill, the one
 * under the first root listed; the others are its copies.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const byName = new Map<string, { root: number; path: string }[]>();
  // A listing can repeat a path: GitHub's search pages overlap.
  for (const path of new Set(paths)) {
    const found = locate(path);
    if (!found) continue;
    const group = byName.get(found.name) ?? [];
    group.push({ root: found.root, path });
    byName.set(found.name, group);
  }
  return [...byName]
    .map(([name, group]) => {
      const [own, ...copies] = group.sort((a, b) => a.root - b.root || compare(a.path, b.path));
      return { path: own.path, name, copies: copies.map((copy) => copy.path) };
    })
    .sort((a, b) => compare(a.name, b.name) || compare(a.path, b.path));
}

/** The skill root and the `<name>` a path stands for, or undefined if it is not a skill. */
function locate(path: string): { root: number; name: string } | undefined {
  const segments = path.split('/');
  // Exactly `<root>/<name>/SKILL.md`: the file is named SKILL.md, under one `<name>`, under a root.
  if (segments.at(-1) !== 'SKILL.md') return undefined;
  const name = segments.at(-2);
  if (!name) return undefined;
  const root = SKILL_ROOTS.indexOf(segments.slice(0, -2).join('/'));
  return root === -1 ? undefined : { root, name };
}

/** The same order everywhere, whatever the locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
