// spec/analysis.md: copies, the rule alone. Through the CLI, the API and the page: scan.test.ts, web-api.test.ts, web.spec.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collapseCopies } from '../src/core/find.ts';
import type { Skill } from '../src/core/model.ts';

function skill(path: string, name: string, description = `${path}.`): Skill {
  return { id: `fixture:${path}`, repository: 'fixture', path, name, description, commit: '', copies: [], properties: {}, body: '' };
}

const collapsed = (skills: Skill[]) => collapseCopies(skills).map((item) => [item.path, item.copies]);

test('copies: the same name in other agents\' folders → one skill, at the first path, the others in path order', () => {
  assert.deepEqual(
    collapsed([
      skill('agent/skills/commits/SKILL.md', 'commits'),
      skill('.github/skills/commits/SKILL.md', 'commits'),
      skill('.claude/skills/commits/SKILL.md', 'commits'),
    ]),
    [['.claude/skills/commits/SKILL.md', ['.github/skills/commits/SKILL.md', 'agent/skills/commits/SKILL.md']]],
  );
});

test('copies: the same name twice in one agent\'s folder → two skills', () => {
  assert.deepEqual(
    collapsed([skill('.claude/skills/review-a/SKILL.md', 'review'), skill('.claude/skills/review-b/SKILL.md', 'review')]),
    [
      ['.claude/skills/review-a/SKILL.md', []],
      ['.claude/skills/review-b/SKILL.md', []],
    ],
  );
});

test('copies: the same name outside the agents\' folders → another skill', () => {
  assert.deepEqual(
    collapsed([skill('.claude/skills/commits/SKILL.md', 'commits'), skill('docs/commits/SKILL.md', 'commits'), skill('packages/x/.claude/skills/commits/SKILL.md', 'commits')]),
    [
      ['.claude/skills/commits/SKILL.md', []],
      ['docs/commits/SKILL.md', []],
      ['packages/x/.claude/skills/commits/SKILL.md', []],
    ],
  );
});

test('copies: the skills passed in are not changed', () => {
  const skills = [skill('.github/skills/commits/SKILL.md', 'commits'), skill('.claude/skills/commits/SKILL.md', 'commits')];
  const before = structuredClone(skills);
  collapseCopies(skills);
  assert.deepEqual(skills, before);
});
