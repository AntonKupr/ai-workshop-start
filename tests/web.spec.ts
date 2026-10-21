// spec/web.md: the page, in a browser, for ./fixture and the GitHub repository answered in
// tests/helpers.ts. Ring UI adds its own words to data-test, hence [data-test~=…].
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXAMPLE_COMMIT, FIXTURE, TOOLS_COMMIT } from './helpers.ts';

async function scan(page: Page, input: string, submit: 'enter' | 'click' = 'enter') {
  await page.goto('/');
  await page.getByLabel('Repository').fill(input);
  if (submit === 'enter') await page.getByLabel('Repository').press('Enter');
  else await page.getByRole('button', { name: 'Scan' }).click();
}

test('a GitHub URL: the header, the skill and its SKILL.md, rendered, with the pinned link', async ({ page }) => {
  await scan(page, 'https://github.com/JetBrains/example');
  await expect(page.locator('[data-test~="header"]')).toHaveText('JetBrains/example · 1 skill');
  await expect(page.locator('[data-test~="skill"]')).toHaveText(['commitsWrite commit messages the way this repository does.']);
  await expect(page.locator('[data-test~="skill"]')).toHaveAttribute('aria-pressed', 'true');

  const view = page.locator('[data-test~="skill-view"]');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('commits');
  await expect(view.locator('[data-test~="description"]')).toHaveText('Write commit messages the way this repository does. Use for every commit.');
  await expect(view.locator('[data-test~="markdown"]').locator('h1')).toHaveText('Commits');
  await expect(view.locator('[data-test~="link"]')).toHaveAttribute(
    'href',
    `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
  );
  await expect(page.locator('[data-test~="warnings"]')).toHaveCount(0);
  await expect(page.locator('[data-test~="error"]')).toHaveCount(0);
});

test('a directory: every skill sorted by name, a warning, and a click selects another', async ({ page }) => {
  await scan(page, FIXTURE, 'click');
  await expect(page.locator('[data-test~="header"]')).toHaveText('fixture · 3 skills');
  await expect(page.locator('[data-test="skill"] .atlas-skill-name')).toHaveText(['code-style', 'commits', 'release-checklist']);
  await expect(page.locator('[data-test~="warnings"]')).toContainText(/\.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);

  const view = page.locator('[data-test~="skill-view"]');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('code-style');
  await expect(view.locator('[data-test~="markdown"]').locator('li')).toHaveText(['Four spaces, no tabs; lines up to 120 characters.', 'Prefer val over var.']);

  await page.locator('[data-test~="skill"]').filter({ hasText: 'release-checklist' }).click();
  await expect(page.locator('[data-test~="skill"]').filter({ hasText: 'release-checklist' })).toHaveAttribute('aria-pressed', 'true');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('release-checklist');
  await expect(view.locator('[data-test~="description"]')).toHaveCount(0);
  await expect(view.locator('[data-test~="markdown"]').locator('ol > li')).toHaveCount(3);
  await expect(view.locator('[data-test~="link"]')).toHaveAttribute('href', `${pathToFileURL(FIXTURE).href}/.agents/skills/release-checklist/SKILL.md`);
});

test('a filter: by name or description, any case; the selection follows; a scan clears it', async ({ page }) => {
  await scan(page, FIXTURE);
  const names = page.locator('[data-test="skill"] .atlas-skill-name');
  const view = page.locator('[data-test~="skill-view"]');
  const filter = page.getByLabel('Filter');
  await expect(names).toHaveText(['code-style', 'commits', 'release-checklist']);
  await expect(filter).toHaveValue('');

  await filter.fill('COMMIT');
  await expect(names).toHaveText(['code-style', 'commits']);
  await expect(page.locator('[data-test~="header"]')).toHaveText('fixture · 3 skills');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('code-style');

  await filter.fill('release');
  await expect(names).toHaveText(['release-checklist']);
  await expect(page.locator('[data-test~="skill"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('release-checklist');

  await filter.fill('no such skill');
  await expect(names).toHaveCount(0);
  await expect(page.locator('[data-test~="no-match"]')).toHaveText('No skills match “no such skill”');
  await expect(view).toHaveCount(0);
  await filter.fill('  no such skill  ');
  await expect(page.locator('[data-test~="no-match"]')).toHaveText('No skills match “no such skill”');

  await filter.fill('');
  await expect(names).toHaveText(['code-style', 'commits', 'release-checklist']);
  await expect(page.locator('[data-test~="no-match"]')).toHaveCount(0);
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('code-style');

  await filter.fill('commits');
  await page.getByLabel('Repository').press('Enter');
  await expect(filter).toHaveValue('');
  await expect(names).toHaveText(['code-style', 'commits', 'release-checklist']);
});

test('an unreachable repository → the CLI message in an error banner', async ({ page }) => {
  await scan(page, join(FIXTURE, 'no-such-directory'));
  await expect(page.locator('[data-test~="error"]')).toContainText(/Not a GitHub URL or a readable directory: .*no-such-directory/);
  await expect(page.locator('[data-test~="header"]')).toHaveCount(0);

  await page.getByLabel('Repository').fill('https://github.com/JetBrains/not-answered');
  await page.getByLabel('Repository').press('Enter');
  await expect(page.locator('[data-test~="error"]')).toContainText('Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered');
});

test('the other front matter, and a SKILL.md whose HTML would run: sanitized', async ({ page }) => {
  const repository = mkdtempSync(join(tmpdir(), 'skill-atlas-unsafe-'));
  try {
    mkdirSync(join(repository, '.claude/skills/unsafe'), { recursive: true });
    writeFileSync(
      join(repository, '.claude/skills/unsafe/SKILL.md'),
      [
        '---',
        'name: unsafe',
        'description: Tries to run a script. It must not.',
        'license: MIT',
        '---',
        '# Unsafe',
        '',
        '<script>window.injected = true</script>',
        '<img src="x" onerror="window.injected = true">',
        '',
        '**Bold** and a [link](javascript:window.injected=true).',
      ].join('\n'),
    );
    await scan(page, repository);
    const view = page.locator('[data-test~="skill-view"]');
    await expect(view.locator('[data-test~="properties"]')).toHaveText('license: MIT');
    await expect(view.locator('[data-test~="markdown"]').locator('strong')).toHaveText('Bold');
    await expect(view.locator('[data-test~="markdown"]').locator('script')).toHaveCount(0);
    await expect(view.locator('[data-test~="markdown"]').locator('img')).not.toHaveAttribute('onerror');
    await view.locator('[data-test~="markdown"]').getByText('link').click();
    expect(await page.evaluate(() => (globalThis as { injected?: boolean }).injected)).toBeUndefined();
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('the list: the filter as wide as the list, a divider between skills, the selected one marked, two lines of summary, its own scroll', async ({ page }) => {
  const repository = mkdtempSync(join(tmpdir(), 'skill-atlas-many-'));
  try {
    for (let index = 10; index < 40; index++) {
      mkdirSync(join(repository, `.claude/skills/skill-${index}`), { recursive: true });
      writeFileSync(
        join(repository, `.claude/skills/skill-${index}/SKILL.md`),
        ['---', `name: skill-${index}`, `description: ${'A very long first sentence that goes on and on '.repeat(6)}. The rest.`, '---', '# Body'].join('\n'),
      );
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await scan(page, repository);
    const skills = page.locator('[data-test="skill"]');
    await expect(skills).toHaveCount(30);

    const filter = await page.getByLabel('Filter').boundingBox();
    const first = await skills.first().boundingBox();
    expect(Math.abs(filter!.width - first!.width)).toBeLessThanOrEqual(2);

    const items = page.locator('[data-test="skills"] > li');
    expect(await items.nth(0).evaluate((item) => item.ownerDocument.defaultView!.getComputedStyle(item).borderTopWidth)).toBe('0px');
    expect(await items.nth(1).evaluate((item) => item.ownerDocument.defaultView!.getComputedStyle(item).borderTopWidth)).toBe('1px');

    const accent = (index: number) => skills.nth(index).evaluate((skill) => skill.ownerDocument.defaultView!.getComputedStyle(skill).borderLeftColor);
    expect(await accent(0)).not.toBe(await accent(1));
    expect(await accent(1)).toBe('rgba(0, 0, 0, 0)');

    const summary = skills.first().locator('.atlas-skill-summary');
    const lineHeight = await summary.evaluate((text) => parseFloat(text.ownerDocument.defaultView!.getComputedStyle(text).lineHeight));
    expect((await summary.boundingBox())!.height).toBeLessThanOrEqual(2 * lineHeight + 1);

    expect((await page.locator('.atlas-list').boundingBox())!.height).toBeLessThanOrEqual(800 - 32);
    // In the window before the page scrolls too, under the header, not only once it sticks.
    const list = (await page.locator('.atlas-list').boundingBox())!;
    expect(list.y).toBeGreaterThan(16);
    expect(list.y + list.height).toBeLessThanOrEqual(800);
    await skills.last().click();
    await expect(skills.last()).toHaveAttribute('aria-pressed', 'true');
    expect(await page.getByLabel('Filter').evaluate((input) => {
      const { x, y, width, height } = input.getBoundingClientRect();
      return input.ownerDocument.elementFromPoint(x + width / 2, y + height / 2) === input;
    })).toBe(true);
    await expect(page.locator('[data-test~="skill-view"]').getByRole('heading', { level: 2 })).toHaveText('skill-39');
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('the same skill in other agents\' folders: listed once, also in the other paths', async ({ page }) => {
  const repository = mkdtempSync(join(tmpdir(), 'skill-atlas-copies-'));
  try {
    for (const path of ['.claude/skills/commits', '.github/skills/commits', '.agents/skills/alpha']) {
      mkdirSync(join(repository, path), { recursive: true });
      writeFileSync(join(repository, path, 'SKILL.md'), `---\nname: ${path.split('/').at(-1)}\ndescription: The ${path.split('/').at(-1)} skill.\n---\n`);
    }
    await scan(page, repository);
    await expect(page.locator('[data-test~="header"]')).toHaveText(`${repository.split('/').at(-1)} · 2 skills`);
    await expect(page.locator('[data-test~="skill"]')).toHaveText([
      'alphaThe alpha skill.',
      'commitsThe commits skill.also in .github/skills/commits/SKILL.md',
    ]);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('a toggle groups the list by the words the names share; a group collapses; the filter applies inside', async ({ page }) => {
  const repository = mkdtempSync(join(tmpdir(), 'skill-atlas-groups-'));
  try {
    for (const name of ['alpha-review', 'build-cache', 'build-scan', 'commits']) {
      mkdirSync(join(repository, '.claude/skills', name), { recursive: true });
      writeFileSync(join(repository, '.claude/skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: The ${name} skill.\n---\n`);
    }
    await scan(page, repository);
    const names = page.locator('[data-test="skill"] .atlas-skill-name');
    const headers = page.locator('[data-test="group"]');
    const toggle = page.getByRole('checkbox', { name: 'Group by shared words' });
    const view = page.locator('[data-test~="skill-view"]');
    await expect(toggle).not.toBeChecked();
    await expect(names).toHaveText(['alpha-review', 'build-cache', 'build-scan', 'commits']);
    await expect(headers).toHaveCount(0);

    await toggle.check({ force: true });
    await expect(headers).toHaveText(['build · 2', 'Other · 2']);
    for (const header of await headers.all()) await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(names).toHaveText(['build-cache', 'build-scan', 'alpha-review', 'commits']);
    await expect(page.locator('[data-test~="header"]')).toHaveText(`${repository.split('/').at(-1)} · 4 skills`);
    await expect(view.getByRole('heading', { level: 2 })).toHaveText('alpha-review');

    await headers.filter({ hasText: 'build' }).click();
    await expect(headers.filter({ hasText: 'build' })).toHaveAttribute('aria-expanded', 'false');
    await expect(headers).toHaveText(['build · 2', 'Other · 2']);
    await expect(names).toHaveText(['alpha-review', 'commits']);
    await headers.filter({ hasText: 'build' }).click();
    await expect(names).toHaveText(['build-cache', 'build-scan', 'alpha-review', 'commits']);

    await page.getByLabel('Filter').fill('CACHE');
    await expect(headers).toHaveText(['build · 1']);
    await expect(names).toHaveText(['build-cache']);
    await expect(view.getByRole('heading', { level: 2 })).toHaveText('build-cache');
    await page.getByLabel('Filter').fill('no such skill');
    await expect(headers).toHaveCount(0);
    await expect(page.locator('[data-test~="no-match"]')).toHaveText('No skills match “no such skill”');
    await page.getByLabel('Filter').fill('');
    await names.getByText('commits').click();
    await page.getByLabel('Filter').fill('a');
    await expect(names).toHaveText(['build-cache', 'build-scan', 'alpha-review']);
    await expect(view.getByRole('heading', { level: 2 })).toHaveText('build-cache');
    await page.getByLabel('Filter').fill('');

    await headers.filter({ hasText: 'Other' }).click();
    await expect(names).toHaveText(['build-cache', 'build-scan']);
    await page.getByLabel('Repository').press('Enter');
    await expect(toggle).toBeChecked();
    for (const header of await headers.all()) await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(names).toHaveText(['build-cache', 'build-scan', 'alpha-review', 'commits']);
    await expect(view.getByRole('heading', { level: 2 })).toHaveText('build-cache');

    await toggle.uncheck({ force: true });
    await expect(headers).toHaveCount(0);
    await expect(names).toHaveText(['alpha-review', 'build-cache', 'build-scan', 'commits']);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('an organization: every repository with skills, its skills under it, and the warnings', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Organization').fill('JetBrains');
  await page.getByLabel('Organization').press('Enter');
  await expect(page.locator('[data-test~="header"]')).toHaveText('JetBrains · 4 repositories · 2 skills');
  await expect(page.locator('[data-test~="repository-group"]')).toHaveText(['JetBrains/example', 'JetBrains/tools']);
  await expect(page.locator('[data-test="skill"] .atlas-skill-name')).toHaveText(['commits', 'release']);
  await expect(page.locator('[data-test~="warnings"]')).toContainText(
    'JetBrains/not-answered: Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered',
  );

  const view = page.locator('[data-test~="skill-view"]');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('commits');
  await page.locator('[data-test~="skill"]').filter({ hasText: 'release' }).click();
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('release');
  await expect(view.locator('[data-test~="markdown"]').locator('h1')).toHaveText('Release');
  await expect(view.locator('[data-test~="link"]')).toHaveAttribute(
    'href',
    `https://github.com/JetBrains/tools/blob/${TOOLS_COMMIT}/skills/release/SKILL.md`,
  );
});

test('an organization that cannot be scanned → the message in an error banner; Look up scans too', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Organization').fill('a/b/c');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('[data-test~="error"]')).toContainText('Not a GitHub organization: a/b/c');
  await expect(page.locator('[data-test~="header"]')).toHaveCount(0);
});

test('an organization: the filter and the groups inside each repository; one with no match is hidden', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Organization').fill('JetBrains');
  await page.getByLabel('Organization').press('Enter');
  const repositories = page.locator('[data-test~="repository-group"]');
  const names = page.locator('[data-test="skill"] .atlas-skill-name');
  const headers = page.locator('[data-test="group"]');
  const view = page.locator('[data-test~="skill-view"]');
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('commits');

  await page.getByLabel('Filter').fill('TAG IT');
  await expect(repositories).toHaveText(['JetBrains/tools']);
  await expect(names).toHaveText(['release']);
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('release');
  await expect(page.locator('[data-test~="header"]')).toHaveText('JetBrains · 4 repositories · 2 skills');
  await page.getByLabel('Filter').fill('no such skill');
  await expect(repositories).toHaveCount(0);
  await expect(page.locator('[data-test~="no-match"]')).toHaveText('No skills match “no such skill”');
  await page.getByLabel('Filter').fill('');

  await page.getByRole('checkbox', { name: 'Group by shared words' }).check({ force: true });
  await expect(repositories).toHaveText(['JetBrains/example', 'JetBrains/tools']);
  await expect(headers).toHaveText(['Other · 1', 'Other · 1']);
  await headers.first().click();
  await expect(headers.first()).toHaveAttribute('aria-expanded', 'false');
  await expect(headers.last()).toHaveAttribute('aria-expanded', 'true');
  await expect(names).toHaveText(['release']);
});
