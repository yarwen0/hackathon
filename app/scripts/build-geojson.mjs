// scripts/build-geojson.mjs
// Download the national county GeoJSON once, filter to Mississippi (STATE='28'),
// and write a slim file to public/ms-counties.geojson. Runs in postinstall.
// Skipped if the output is already present (no network needed on rebuild).

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'ms-counties.geojson');
const SOURCE_URL =
  'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'egi-workbench-build/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  if (fs.existsSync(OUT_PATH)) {
    const stat = fs.statSync(OUT_PATH);
    if (stat.size > 100_000) {
      console.log(`[geojson] reusing existing ${path.relative(process.cwd(), OUT_PATH)} (${stat.size} B)`);
      return;
    }
  }

  console.log(`[geojson] downloading ${SOURCE_URL} ...`);
  let body;
  try {
    body = await fetchText(SOURCE_URL);
  } catch (err) {
    console.warn(`[geojson] download failed: ${err.message}`);
    console.warn('[geojson] continuing without GeoJSON — map will degrade to a list.');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    console.warn(`[geojson] JSON parse failed: ${err.message}`);
    return;
  }

  const features = (parsed.features || []).filter((f) => {
    const id = f.id || f.properties?.GEOID || f.properties?.FIPS;
    if (!id) return false;
    return String(id).startsWith('28');
  });

  if (features.length === 0) {
    console.warn('[geojson] no features matched STATE=28; aborting.');
    return;
  }

  // Normalize: stash the 5-char FIPS as feature.id so leaflet can key by it.
  for (const f of features) {
    const id = f.id || f.properties?.GEOID || f.properties?.FIPS;
    f.id = String(id);
  }

  const out = { type: 'FeatureCollection', features };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(`[geojson] wrote ${features.length} MS counties → ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((err) => {
  console.error('[geojson] fatal:', err);
  process.exit(0); // never block install
});
