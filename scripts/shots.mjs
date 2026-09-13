// Screenshots of the board at TV resolutions using demo data, plus an
// end-to-end import of three fake LCR PDFs.
// Usage: npm run build && npx vite preview --port 4173 (in another terminal), then npm run shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const URL = process.env.URL ?? 'http://localhost:4173';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

/**
 * A PDF laid out like LCR's printed reports (fictional names): ward/stake
 * title, column headings, rows, a page footer. '✔' cells use ZapfDingbats
 * like a real checkmark; cells over 30 characters wrap onto two lines.
 */
async function fakeLcrPdf(title, heads, xs, rows, perPage = 4) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const dings = await doc.embedFont(StandardFonts.ZapfDingbats);
  for (let p = 0; p * perPage < rows.length; p++) {
    const page = doc.addPage([612, 792]);
    const text = (s, x, y, f = font) => page.drawText(s, { x, y, size: 9, font: f });
    text('Maple Grove Ward (1234567)', 40, 760);
    text(title, 460, 760);
    heads.forEach((h, i) => text(h, xs[i], 720));
    rows.slice(p * perPage, (p + 1) * perPage).forEach((row, i) => {
      const y = 698 - i * 24;
      row.forEach((c, j) => {
        if (!c) return;
        if (c === '✔') return text(c, xs[j] + 12, y, dings);
        if (c.length > 30) {
          const cut = c.lastIndexOf(' ', 30);
          text(c.slice(0, cut), xs[j], y + 5);
          text(c.slice(cut + 1), xs[j], y - 5);
        } else text(c, xs[j], y);
      });
    });
    text(`Page ${p + 1}`, 520, 40);
  }
  return Buffer.from(await doc.save());
}

const callingsPdf = () =>
  fakeLcrPdf(
    'Members with Callings',
    ['Name', 'Gender', 'Age', 'Birth Date', 'Organization', 'Calling', 'Sustained', 'Set Apart'],
    [40, 150, 185, 212, 268, 360, 505, 556],
    [
      ['Ashby, Levi', 'M', '50', '1 Jan 1976', 'Bishopric', 'Bishop', '12 Oct 2025', '✔'],
      ['Barlow, Brooke', 'F', '31', '1 Jan 1995', 'Primary', 'Primary President', '12 Oct 2025', '✔'],
      ['Calder, Clara', 'F', '49', '1 Jan 1977', 'Relief Society', 'Relief Society Compassionate Service Coordinator', '12 Oct 2025', '✔'],
      ['Draper, Grace', 'F', '61', '1 Jan 1965', 'Young Women', 'Young Women Secretary', '12 Oct 2025', ''],
      ['Everton, Wesley', 'M', '59', '1 Jan 1967', 'Elders Quorum', 'Elders Quorum President', '12 Oct 2025', '✔'],
      ['Farnsworth, Ivy', 'F', '44', '1 Jan 1982', 'Sunday School', 'Gospel Doctrine Teacher', '12 Oct 2025', '✔'],
    ],
  );

const uncalledPdf = () =>
  fakeLcrPdf(
    'Members without Callings',
    ['Name', 'Gender', 'Age', 'Birth Date'],
    [40, 220, 280, 330],
    [
      ['Gale, Hazel', 'F', '38', '1 Jan 1988'],
      ['Hatch, Owen', 'M', '27', '1 Jan 1999'],
      ['Ingram, June', 'F', '72', '1 Jan 1954'],
    ],
  );

const stakePdf = () =>
  fakeLcrPdf(
    'Stake Callings',
    ['Name', 'Organization', 'Calling', 'Sustained', 'Set Apart'],
    [40, 170, 300, 470, 540],
    [
      ['Jessop, Micah', 'Stake High Council', 'High Councilor', '9 Sep 2024', '✔'],
      ['Kimball, Rose', 'Stake Primary', 'Stake Primary Second Counselor', '3 Mar 2025', '✔'],
    ],
  );

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
    await drag(page, rail.locator('.person').nth(2), eq.locator('.slot').first());
    // Propose a new calling by dropping someone on a placeholder.
    await drag(page, rail.locator('.person').nth(4), eq.locator('.placeholder').first());
    await page.screenshot({ path: `${OUT}/scenario-${w}.png` });

    await page.getByRole('button', { name: /^Changes/ }).click();
    await page.screenshot({ path: `${OUT}/changes-${w}.png` });
    await page.getByRole('button', { name: /^Changes/ }).click();

    await page.locator('section[aria-label="Primary"] .card-head button').click();
    await page.screenshot({ path: `${OUT}/focus-${w}.png` });
    await page.keyboard.press('Escape');

    // Real-world path: the three LCR reports, printed to PDF.
    await page.getByRole('button', { name: 'Import' }).click();
    await page.screenshot({ path: `${OUT}/import-${w}.png` });
    const inputs = page.locator('.drop input[type=file]');
    await inputs.nth(0).setInputFiles({ name: 'callings.pdf', mimeType: 'application/pdf', buffer: await callingsPdf() });
    await page.getByText('"callings.pdf": 6 rows').waitFor({ timeout: 15000 });
    await inputs.nth(1).setInputFiles({ name: 'uncalled.pdf', mimeType: 'application/pdf', buffer: await uncalledPdf() });
    await page.getByText('"uncalled.pdf": 3 rows').waitFor({ timeout: 15000 });
    await inputs.nth(2).setInputFiles({ name: 'stake.pdf', mimeType: 'application/pdf', buffer: await stakePdf() });
    await page.getByText('"stake.pdf": 2 rows').waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/import-pdf-${w}.png` });
    await page.getByRole('button', { name: 'Replace current data' }).click();
    await page.getByText('Imported 8 callings and 11 members').waitFor();
    await page.screenshot({ path: `${OUT}/after-pdf-${w}.png` });
  }
  await page.close();
}

await browser.close();
console.log(`Screenshots written to ${OUT}/`);
