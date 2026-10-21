// Grouping the list by the words the skills' names share: spec/web.md.
import type { WebSkill } from './api.ts';

/** Skills that share a word of their names; `word` is undefined for Other, the rest. */
export type Group = { word?: string; skills: WebSkill[] };

/** A name's words: split at -, _, . and spaces, in lower case, of two letters or more. */
function words(name: string): Set<string> {
  return new Set(name.toLowerCase().split(/[-_.\s]+/).filter((word) => word.length >= 2));
}

/**
 * The word the most skills share makes a group, then the next among the rest, while a word joins
 * at least two; a tie goes to the first word alphabetically. Sorted by word, Other last; each group
 * keeps the skills' order.
 */
export function groups(skills: WebSkill[]): Group[] {
  const named = skills.map((skill) => ({ skill, words: words(skill.name) }));
  const result: Group[] = [];
  let rest = named;
  for (;;) {
    const counts = new Map<string, number>();
    for (const { words } of rest) for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    let best: string | undefined;
    for (const [word, count] of counts) {
      const top = best === undefined ? 0 : counts.get(best)!;
      if (count >= 2 && (count > top || (count === top && word < best!))) best = word;
    }
    if (best === undefined) break;
    const word = best;
    result.push({ word, skills: rest.filter((item) => item.words.has(word)).map((item) => item.skill) });
    rest = rest.filter((item) => !item.words.has(word));
  }
  result.sort((a, b) => (a.word! < b.word! ? -1 : a.word! > b.word! ? 1 : 0));
  if (rest.length > 0) result.push({ skills: rest.map((item) => item.skill) });
  return result;
}
