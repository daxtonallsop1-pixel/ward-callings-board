// Screenshots of the board at TV resolutions, using demo data.
// Usage: npm run build && npx vite preview --port 4173 (in another terminal), then npm run shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:4173';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function drag(page, from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

for (const [w, h] of [
  [1920, 1080],
  [3840, 2160],
  [1366, 768],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Try it with demo data' }).click();
  await page.screenshot({ path: `${OUT}/board-${w}.png` });

  if (w === 1920) {
    // Planning: new scenario, move the EQ president out, put someone new in.
    await page.getByRole('button', { name: /Current \(LCR\)/ }).click();
    await page.getByRole('button', { name: 'New scenario from Current' }).click();
    const eq = page.locator('section[aria-label="Elders Quorum"]');
    const firstHolder = eq.locator('.holder').first();
    const rail = page.locator('aside.rail');
    await drag(page, firstHolder, rail);
    await rail.getByRole('button', { name: 'Men', exact: true }).click();
    const person = rail.locator('.person').nth(2);
    await drag(page, person, eq.locator('.slot').first());
    // Propose a new calling by dropping someone on a placeholder.
    await drag(page, rail.locator('.person').nth(4), eq.locator('.placeholder').first());
    await page.screenshot({ path: `${OUT}/scenario-${w}.png` });

    await page.getByRole('button', { name: /^Changes/ }).click();
    await page.screenshot({ path: `${OUT}/changes-${w}.png` });
    await page.getByRole('button', { name: /^Changes/ }).click();

    await page.locator('section[aria-label="Primary"] .card-head button').click();
    await page.screenshot({ path: `${OUT}/focus-${w}.png` });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Import' }).click();
    await page.screenshot({ path: `${OUT}/import-${w}.png` });
  }
  await page.close();
}

await browser.close();
console.log(`Screenshots written to ${OUT}/`);
