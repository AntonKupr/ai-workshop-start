// spec/web.md: grouping the list by the words the skills' names share, the rule alone. The page: tests/web.spec.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groups } from '../web/group.ts';
import type { WebSkill } from '../web/api.ts';

function skill(name: string): WebSkill {
  const path = `.agents/skills/${name}/SKILL.md`;
  return { id: `fixture:${path}`, repository: 'fixture', path, name, description: '', commit: '', copies: [], properties: {}, body: '', link: '', summary: '' };
}

const grouped = (...names: string[]) => groups(names.map(skill)).map((group) => [group.word ?? 'Other', ...group.skills.map((item) => item.name)]);

test('group: by the word the most names share, then the next among the rest; Other last', () => {
  assert.deepEqual(grouped('build-tools-bump-gradle-api', 'build-tools-release', 'gradle-sync', 'gradle-cache', 'kotlin-gradle-plugin', 'commits'), [
    ['gradle', 'build-tools-bump-gradle-api', 'gradle-sync', 'gradle-cache', 'kotlin-gradle-plugin'],
    ['Other', 'build-tools-release', 'commits'],
  ]);
  assert.deepEqual(grouped('build-tools-bump', 'build-tools-release', 'gradle-sync', 'gradle-cache', 'commits'), [
    ['build', 'build-tools-bump', 'build-tools-release'],
    ['gradle', 'gradle-sync', 'gradle-cache'],
    ['Other', 'commits'],
  ]);
});

test('group: a word joins at least two skills; none shared → every skill in Other', () => {
  assert.deepEqual(grouped('code-style', 'commits', 'release-checklist'), [['Other', 'code-style', 'commits', 'release-checklist']]);
  assert.deepEqual(grouped(), []);
});

test('group: words in any case, split at -, _, . and spaces; one letter is not a word', () => {
  assert.deepEqual(grouped('Review_PR', 'pr.merge', 'a-x', 'a-y'), [['pr', 'Review_PR', 'pr.merge'], ['Other', 'a-x', 'a-y']]);
});

test('group: a tie goes to the first word in alphabetical order; groups sorted by word', () => {
  assert.deepEqual(grouped('zeta-alpha-one', 'zeta-alpha-two', 'beta-x', 'beta-y'), [
    ['alpha', 'zeta-alpha-one', 'zeta-alpha-two'],
    ['beta', 'beta-x', 'beta-y'],
  ]);
});

test('group: the same word twice in a name counts once', () => {
  assert.deepEqual(grouped('test-test', 'other'), [['Other', 'test-test', 'other']]);
});
