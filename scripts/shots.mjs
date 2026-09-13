// Screenshots of the board at TV resolutions, using demo data.
// Usage: npm run build && npx vite preview --port 4173 (in another terminal), then npm run shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** A 2-page PDF laid out like LCR's printed "Members with Callings" (fake names). */
async function fakeCallingsPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const dings = await doc.embedFont(StandardFonts.ZapfDingbats);
  const X = [40, 150, 185, 212, 268, 360, 505, 556];
  const heads = ['Name', 'Gender', 'Age', 'Birth Date', 'Organization', 'Calling', 'Sustained', 'Set Apart'];
  const people = [
    ['Ashby, Levi', 'M', '50', 'Bishopric', 'Bishop'],
    ['Barlow, Brooke', 'F', '31', 'Primary', 'Primary President'],
    ['Calder, Clara', 'F', '49', 'Relief Society', 'Relief Society Compassionate Service Coordinator'],
    ['Draper, Grace', 'F', '61', 'Young Women', 'Young Women Secretary'],
    ['Everton, Wesley', 'M', '59', 'Elders Quorum', 'Elders Quorum President'],
    ['Farnsworth, Ivy', 'F', '44', 'Sunday School', 'Gospel Doctrine Teacher'],
  ];
  const perPage = 4;
  for (let p = 0; p * perPage < people.length; p++) {
    const page = doc.addPage([612, 792]);
    const text = (s, x, y, f = font) => page.drawText(s, { x, y, size: 9, font: f });
    text('Maple Grove Ward (1234567)', 40, 760);
    text('Members with Callings', 480, 760);
    heads.forEach((h, i) => text(h, X[i], 720));
    people.slice(p * perPage, (p + 1) * perPage).forEach(([n, g, a, org, calling], i) => {
      const y = 698 - i * 24;
      [n, g, a, '1 Jan 1990', org].forEach((c, j) => text(c, X[j], y));
      if (calling.length > 30) {
        text(calling.slice(0, 28), X[5], y + 5);
        text(calling.slice(29), X[5], y - 5);
      } else text(calling, X[5], y);
      text('12 Oct 2025', X[6], y);
      text('✔', X[7] + 12, y, dings); // pdf-lib maps U+2714 to the ZapfDingbats checkmark
    });
    text(`Page ${p + 1}`, 520, 40);
  }
  return Buffer.from(await doc.save());
}

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

    // Simulate copying the Members with Callings table off an LCR page
    // (browsers put an HTML table on the clipboard, with page chrome around it).
    await page.locator('textarea.paste').first().evaluate((el) => {
      const rows = [
        ['Name', 'Gender', 'Age', 'Organization', 'Calling', 'Sustained', 'Set Apart'],
        ['Doe, Jane', 'F', '40', 'Primary', 'Primary Teacher', '5 Mar 2025', '✔'],
        ['Roe, Sam', 'M', '52', 'Elders Quorum', 'Elders Quorum President', '1 Jan 2026', ''],
        ['Poe, Ann', 'F', '33', 'Relief Society', 'Relief Society Compassionate Service Coordinator', '2 Feb 2026', '✔'],
      ];
      const html = `<nav>Menu</nav><h1>Members with Callings</h1><table>${rows
        .map((r, i) => `<tr>${r.map((c) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`)
        .join('')}</table><footer>Privacy</footer>`;
      const dt = new DataTransfer();
      dt.setData('text/html', html);
      dt.setData('text/plain', rows.map((r) => r.join('\t')).join('\n'));
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.getByText('the pasted table: 3 rows').waitFor();
    await page.screenshot({ path: `${OUT}/import-paste-${w}.png` });

    // Now the real-world path: drop a printed-to-PDF LCR report.
    await page.locator('.drop input[type=file]').first().setInputFiles({ name: 'callings.pdf', mimeType: 'application/pdf', buffer: await fakeCallingsPdf() });
    await page.getByText('"callings.pdf": 6 rows').waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/import-pdf-${w}.png` });
    await page.getByRole('button', { name: 'Replace current data' }).click();
    await page.getByText('Imported 6 callings').waitFor();
    await page.screenshot({ path: `${OUT}/after-pdf-${w}.png` });
  }
  await page.close();
}

await browser.close();
console.log(`Screenshots written to ${OUT}/`);
