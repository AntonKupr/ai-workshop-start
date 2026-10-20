// spec/web.md: the filter above the list, the rule alone. The page around it: tests/web.spec.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matching } from '../web/filter.ts';
import type { WebSkill } from '../web/api.ts';

function skill(name: string, description: string): WebSkill {
  const path = `.agents/skills/${name}/SKILL.md`;
  return { id: `fixture:${path}`, repository: 'fixture', path, name, description, commit: '', copies: [], properties: {}, body: '', link: '', summary: '' };
}

const skills = [
  skill('code-style', 'How code is formatted. Run it before committing.'),
  skill('commits', 'How to write a commit message.'),
  skill('release-checklist', ''),
];
const names = (filter: string) => matching(skills, filter).map((item) => item.name);

test('filter: a name or a description matches, in any case', () => {
  assert.deepEqual(names('release'), ['release-checklist']);
  assert.deepEqual(names('formatted'), ['code-style']);
  assert.deepEqual(names('COMMIT'), ['code-style', 'commits']);
});

test('filter: empty → every skill; no match → none', () => {
  assert.deepEqual(names(''), ['code-style', 'commits', 'release-checklist']);
  assert.deepEqual(names('no such skill'), []);
});

test('filter: the spaces around it are ignored', () => {
  assert.deepEqual(names('  release  '), ['release-checklist']);
  assert.deepEqual(names('   '), ['code-style', 'commits', 'release-checklist']);
});
