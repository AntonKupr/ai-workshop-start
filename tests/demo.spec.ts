// The demo of spec/web.md's filter, step by step as in .agents/skills/demo-recorder/SKILL.md:
// run twice, a screenshot after every step; a single different pixel between the runs fails.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { FIXTURE } from './helpers.ts';

// The demo window: chromium --window-size=1100,700.
const VIEWPORT = { width: 1100, height: 700 };

// Raster in one thread, the whole tile at once: else the anti-aliased corners differ by one in a channel.
// Not the recorder's `chromium --disable-gpu`: the two runs are compared with each other, never with its video.
test.use({ launchOptions: { args: ['--disable-partial-raster', '--disable-gpu-rasterization', '--num-raster-threads=1'] } });

type Step = { name: string; act: (page: Page) => Promise<void> };

const names = (page: Page) => page.locator('[data-test="skill"] .atlas-skill-name');
const heading = (page: Page) => page.locator('[data-test~="skill-view"]').getByRole('heading', { level: 2 });

const STEPS: Step[] = [
  {
    name: 'scan',
    act: async (page) => {
      await page.getByLabel('Repository').fill(FIXTURE);
      await page.getByLabel('Repository').press('Enter');
      await expect(page.locator('[data-test~="header"]')).toHaveText('fixture · 3 skills');
      await expect(names(page)).toHaveText(['code-style', 'commits', 'release-checklist']);
      await expect(page.locator('[data-test~="skill"]').first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-test~="warnings"]')).toBeVisible();
    },
  },
  {
    name: 'filter',
    act: async (page) => {
      await page.getByLabel('Filter').pressSequentially('commits');
      await expect(names(page)).toHaveText(['commits']);
      await expect(heading(page)).toHaveText('commits');
    },
  },
  {
    name: 'clear',
    act: async (page) => {
      await page.locator('.atlas-filter').getByTitle('Clear input').click();
      await expect(page.getByLabel('Filter')).toHaveValue('');
      await expect(names(page)).toHaveText(['code-style', 'commits', 'release-checklist']);
    },
  },
  {
    name: 'any-case',
    act: async (page) => {
      await page.getByLabel('Filter').pressSequentially('COMMITS');
      await expect(names(page)).toHaveText(['commits']);
      await expect(heading(page)).toHaveText('commits');
    },
  },
  {
    name: 'no-match',
    act: async (page) => {
      await page.getByLabel('Filter').fill('no such skill');
      await expect(names(page)).toHaveCount(0);
      await expect(page.locator('[data-test~="no-match"]')).toHaveText('No skills match “no such skill”');
    },
  },
];

// As toHaveScreenshot does: until two in a row are the same, as the page may still be painting.
async function stableScreenshot(page: Page): Promise<Buffer> {
  let previous = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(100);
    const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
    if (screenshot.equals(previous)) return screenshot;
    previous = screenshot;
  }
  throw new Error('The page did not settle: no two screenshots in a row were the same');
}

async function demo(browser: Browser, run: number): Promise<Buffer[]> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const screenshots: Buffer[] = [];
    for (const [index, step] of STEPS.entries()) {
      await step.act(page);
      const screenshot = await stableScreenshot(page);
      await test.info().attach(`run ${run}, step ${index + 1}: ${step.name}`, { body: screenshot, contentType: 'image/png' });
      screenshots.push(screenshot);
    }
    return screenshots;
  } finally {
    await context.close();
  }
}

type Pixels = { width: number; height: number; channels: number; data: Buffer };

// A PNG as Chromium writes it: 8 bits, RGB or RGBA, not interlaced; every row is unfiltered here (filters 0–4).
function decode(png: Buffer): Pixels {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const [depth, color, , , interlace] = png.subarray(24, 29);
  if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0) throw new Error(`Unexpected PNG: depth ${depth}, color ${color}, interlace ${interlace}`);
  const channels = color === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    if (png.toString('latin1', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const filtered = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? data[y * stride + x - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0;
      const paeth = () => {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        return a <= b && a <= c ? left : b <= c ? up : upLeft;
      };
      const predictor = filter === 4 ? paeth() : [0, left, up, (left + up) >> 1][filter];
      data[y * stride + x] = filtered[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  return { width, height, channels, data };
}

// The number of pixels that differ in any channel, or of all of them if the sizes do.
function differentPixels(first: Buffer, second: Buffer): number {
  const [a, b] = [decode(first), decode(second)];
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) return Math.max(a.width * a.height, b.width * b.height);
  let different = 0;
  for (let i = 0; i < a.data.length; i += a.channels) {
    if (!a.data.subarray(i, i + a.channels).equals(b.data.subarray(i, i + a.channels))) different++;
  }
  return different;
}

test('the filter demo, run twice: the same screenshots, pixel for pixel', async ({ browser }) => {
  // A page that never settles takes 2 runs × 5 steps × (20 waits of 100 ms + 21 screenshots): more than the
  // default 30 s, which would hide stableScreenshot's error behind a generic timeout.
  test.setTimeout(120_000);
  const first = await demo(browser, 1);
  const second = await demo(browser, 2);
  expect(second).toHaveLength(STEPS.length);
  for (const [index, step] of STEPS.entries()) {
    expect(differentPixels(first[index], second[index]), `step ${index + 1}: ${step.name}`).toBe(0);
  }
});
