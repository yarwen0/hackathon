// scripts/screenshots.mjs
// Optional: capture the seven surfaces with Playwright for the submission ZIP.
// Run: npx playwright install chromium && node scripts/screenshots.mjs
// Pre-req: dev server running on http://localhost:3000 (or set BASE_URL env var)

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const SHOTS_AUTHED = [
  { path: '/', name: '02-landing' },
  { path: '/county/28055', name: '03-county-issaquena' },
  { path: '/compare?a=28055&b=28051', name: '04-compare' },
  { path: '/cohort', name: '05-cohort-default' },
  { path: '/cohort?region=Delta&rural=1&egiMin=75', name: '05b-cohort-delta' },
  { path: '/quadrant', name: '06-quadrant' },
  { path: '/reweight', name: '07-reweight' },
  { path: '/methodology', name: '08-methodology' },
  { path: '/ask', name: '09-ask' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture login screen FIRST (no session yet), then sign in for the rest.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT_DIR, 'round2_01-login.png'),
    fullPage: true,
  });
  console.log('captured 01-login');

  await page.click('button:has-text("program officer")');
  await page.waitForURL('**/');

  for (const shot of SHOTS_AUTHED) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, `round2_${shot.name}.png`),
      fullPage: true,
    });
    console.log(`captured ${shot.name}`);
  }

  await browser.close();
  console.log(`\nDone. ${SHOTS_AUTHED.length + 1} screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
