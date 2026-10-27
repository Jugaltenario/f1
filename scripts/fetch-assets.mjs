#!/usr/bin/env node
/**
 * Downloads every image the app needs and regenerates the manifest.
 *
 *   npm run assets:fetch
 *
 * Sources, in order of preference:
 *   1. Formula 1 CDN  — official team logos and circuit maps, consistent style.
 *   2. Wikimedia Commons — legacy circuits, historic team marks, archive photos.
 *   3. English Wikipedia — fair-use marks that Commons cannot host.
 *
 * Commons SVGs are rasterised to PNG by `Special:FilePath?width=…`, so every
 * local asset has a predictable, web-friendly format. Anything that cannot be
 * sourced is left out of the manifest and falls back to a typographic crest in
 * the UI — the app never requests a file that does not exist.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ARCHIVE = path.join(ROOT, 'frontend', 'src', 'assets', 'archive');
const IMAGE_ROOT = path.join(ROOT, 'frontend', 'src', 'assets', 'images');
const MANIFEST = path.join(ROOT, 'frontend', 'src', 'app', 'core', 'config', 'asset-manifest.ts');

const OPENF1 = 'https://api.openf1.org/v1';
const F1_TEAMS = (year, slug) => `https://media.formula1.com/content/dam/fom-website/teams/${year}/${slug}.png`;
const F1_CIRCUIT = (key) =>
  `https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${key}_Circuit.png`;
const commons = (file, width) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;
const enwiki = (file, width) =>
  `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;

const FIRST_PHOTO_YEAR = 2023;
const LAST_YEAR = new Date().getFullYear();
const GAP = 350;

// ---------------------------------------------------------------------------
// Curated sources
// ---------------------------------------------------------------------------
/** Current teams come from F1's own CDN so the marks match the broadcast look. */
const TEAM_CDN = {
  mclaren: [2025, 'mclaren'],
  ferrari: [2025, 'ferrari'],
  red_bull: [2025, 'red-bull-racing'],
  mercedes: [2025, 'mercedes'],
  aston_martin: [2025, 'aston-martin'],
  alpine: [2025, 'alpine'],
  williams: [2025, 'williams'],
  rb: [2025, 'rb'],
  sauber: [2025, 'kick-sauber'],
  haas: [2025, 'haas'],
  alfa: [2022, 'alfa-romeo'],
  renault: [2021, 'renault'],
  toro_rosso: [2020, 'toro-rosso'],
  racing_point: [2020, 'racing-point'],
  alphatauri: [2023, 'alphatauri'],
};

/** Legacy teams: Commons first, then English Wikipedia for fair-use marks. */
const TEAM_WIKI = {
  bmw_sauber: ['BMW Sauber F1 Team logo.png'],
  toyota: ['Panasonic Toyota Racing logo.svg'],
  super_aguri: ['Super Aguri logo.svg'],
  honda: ['Logo Honda F1.svg'],
  spyker: ['Spyker Cars logo.svg', '!Spyker Cars logo.svg'],
  force_india: ['Mini Free Logo Force India.png'],
  jordan: ['Jordan Grand Prix logo.png', '!Jordan Grand Prix logo.png'],
  minardi: ['Minardi F1 Team.svg'],
  prost: ['Prost Grand Prix Formula One Logo.png'],
  arrows: ['Arrows Grand Prix logo.png'],
  benetton: ['!Benetton Formula logo.jpg'],
  brawn: ['Brawn GP logo.svg'],
  hrt: ['HRT F1 TEAM 2012.svg'],
  caterham: ['Caterham F1 Team logo.svg', '!Caterham F1 Team logo.svg'],
  lotus_f1: ['Lotus F1 Team logo.jpg'],
  manor: ['Manor F1 Team logo.png'],
  bar: ['!BAR logo.png', '!British American Racing (HONDA) logo.png'],
  virgin: ['!Virgin Racing logo.png'],
  audi: ['Audif1.com logo17 (cropped).svg'],
  cadillac: ['!Cadillac Formula 1 Team Logo (2025).svg'],
};

/**
 * Circuit maps. `cdn` uses F1's 16:9 map set (the same artwork used on race
 * weekends); `wiki` uses a rasterised Commons SVG. A leading `!` means the file
 * lives on English Wikipedia rather than Commons.
 */
const CIRCUITS = {
  albert_park: { cdn: 'Australia' },
  sepang: { wiki: 'Circuit Sepang.svg' },
  bahrain: { cdn: 'Bahrain' },
  imola: { cdn: 'Emilia_Romagna' },
  catalunya: { cdn: 'Spain' },
  istanbul: { cdn: 'Turkey' },
  monaco: { cdn: 'Monaco' },
  villeneuve: { cdn: 'Canada' },
  magny_cours: { wiki: 'Circuit de Nevers Magny-Cours.svg' },
  silverstone: { cdn: 'Great_Britain' },
  hockenheimring: { cdn: 'Germany' },
  hungaroring: { cdn: 'Hungary' },
  valencia: { wiki: 'Circuit Valencia street.svg' },
  spa: { cdn: 'Belgium' },
  monza: { cdn: 'Italy' },
  marina_bay: { cdn: 'Singapore' },
  fuji: { wiki: 'Circuit Fuji.svg' },
  shanghai: { cdn: 'China' },
  interlagos: { cdn: 'Brazil' },
  indianapolis: { wiki: 'Indianapolis Motor Speedway - road course.svg' },
  nurburgring: { cdn: 'Eifel' },
  suzuka: { cdn: 'Japan' },
  vegas: { cdn: 'Las_Vegas' },
  yas_marina: { cdn: 'Abu_Dhabi' },
  rodriguez: { cdn: 'Mexico' },
  ricard: { cdn: 'France' },
  yeongam: { wiki: 'Korea international circuit v3.svg' },
  zandvoort: { cdn: 'Netherlands' },
  buddh: { wiki: 'Buddh International Circuit.svg' },
  americas: { cdn: 'USA' },
  red_bull_ring: { cdn: 'Austria' },
  sochi: { wiki: 'F-1 Sochi-Autodrom Scheme.jpg' },
  baku: { wiki: 'Baku Formula One circuit map.svg' },
  portimao: { cdn: 'Portugal' },
  mugello: { cdn: 'Tuscany' },
  jeddah: { cdn: 'Saudi_Arabia' },
  losail: { cdn: 'Qatar' },
  miami: { cdn: 'Miami' },
  madring: { wiki: 'Circuito Madring trazado.jpg' },
};

/** Archive photography for the history page. Period images first. */
const HISTORY = {
  'mp4-4': { file: '1988 McLaren MP4-4 1.jpg', license: 'CC0', credit: 'Wikimedia Commons' },
  'senna-mclaren': {
    file: 'Ayrton Senna McLaren MP4 4 Goodwood Festival of Speed 2013 (22904979802).jpg',
    license: 'CC BY 2.0',
    credit: 'Wikimedia Commons',
  },
  'senna-montreal': { file: 'Ayrton Senna Montreal 1988.jpg', license: 'CC BY-SA 2.0', credit: 'Wikimedia Commons' },
  'hunt-lauda': { file: 'Hunt e Lauda a Monza.JPG', license: 'Public domain', credit: 'Wikimedia Commons' },
  'lauda-1982': { file: 'Lauda at 1982 Dutch Grand Prix.jpg', license: 'CC BY 2.0', credit: 'Wikimedia Commons' },
  'hunt-1977': { file: 'J. Hunt in 1977 (cropped).jpg', license: 'CC BY-SA 2.0', credit: 'Wikimedia Commons' },
  'williams-fw11b': {
    file: '1987 Williams-Honda FW11B + 1992 Williams-Renault FW14B Goodwood, 2009 (01).jpg',
    license: 'CC BY-SA 4.0',
    credit: 'Wikimedia Commons',
  },
  'schumacher-2005': { file: 'Michael Schumacher, September 2005.jpg', license: 'CC BY-SA 2.0', credit: 'Wikimedia Commons' },
  'senna-1988': { file: 'Ayrton Senna in 1988.jpg', license: 'CC BY 2.0', credit: 'Wikimedia Commons' },
};

const F1_LOGO = { file: 'F1 logo.svg', license: 'Public domain (simple mark)', credit: 'Wikimedia Commons' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalise = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url, label) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'PaddockF1/1.0 (student project)' } });
      if (response.ok) return await response.json();
      if (response.status === 404) return [];
      if (response.status === 429) {
        await sleep((Number(response.headers.get('retry-after')) || 4 * attempt) * 1_000);
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 4) {
        console.warn(`  ! ${label}: ${error.message}`);
        return [];
      }
      await sleep(700 * attempt);
    }
  }
  return [];
}

const extensionFor = (type) => {
  if (!type) return 'png';
  if (type.includes('svg')) return 'svg';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'png';
};

/**
 * Download `url` to `dir/base.EXT`, guessing the extension from the response.
 * Returns the saved filename, or null when the source is unusable.
 */
async function download(url, dir, base, { minBytes = 1_500 } = {}) {
  for (const ext of ['png', 'jpg', 'svg', 'webp']) {
    if (await exists(path.join(dir, `${base}.${ext}`))) return `${base}.${ext}`;
  }

  await sleep(GAP);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'PaddockF1/1.0 (student project)', accept: 'image/*' },
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < minBytes) return null;
    const filename = `${base}.${extensionFor(type)}`;
    await writeFile(path.join(dir, filename), buffer);
    return filename;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Archive readers
// ---------------------------------------------------------------------------
async function readArchive(name) {
  const csv = await readFile(path.join(ARCHIVE, name), 'utf8');
  const [header, ...lines] = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const columns = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(columns.map((column, i) => [column, cells[i]]));
  });
}

async function collectOpenF1Drivers() {
  const found = new Map();

  for (let year = FIRST_PHOTO_YEAR; year <= LAST_YEAR; year += 1) {
    const sessions = await fetchJson(`${OPENF1}/sessions?year=${year}`, `${year} sessions`);
    const races = (Array.isArray(sessions) ? sessions : []).filter(
      (session) => session.session_name === 'Race' && !session.is_cancelled,
    );

    const meetings = new Set();
    const picks = [];
    for (const race of races) {
      if (meetings.has(race.meeting_key)) continue;
      meetings.add(race.meeting_key);
      picks.push(race);
    }

    console.log(`  ${year}: ${picks.length} race meetings`);
    for (const race of picks) {
      const drivers = await fetchJson(`${OPENF1}/drivers?session_key=${race.session_key}`, `${year} drivers`);
      for (const driver of Array.isArray(drivers) ? drivers : []) {
        if (!driver?.headshot_url || !driver?.last_name) continue;
        // OpenF1 now hands back a placeholder path for recent seasons; the real
        // portrait is the same URL with the fallback segment removed.
        const url = driver.headshot_url.replace('/d_driver_fallback_image.png', '');
        const key = driver.name_acronym || `${normalise(driver.first_name)}_${normalise(driver.last_name)}`;
        const existing = found.get(key);
        if (!existing || existing.year < year) found.set(key, { ...driver, url, year });
      }
      await sleep(GAP);
    }
  }

  return [...found.values()];
}

function matchDriver(openF1Driver, archiveDrivers) {
  const acronym = (openF1Driver.name_acronym ?? '').toUpperCase();
  if (acronym) {
    const byCode = archiveDrivers.filter((driver) => (driver.code ?? '').toUpperCase() === acronym);
    if (byCode.length === 1) return byCode[0];
  }

  const surname = normalise(openF1Driver.last_name);
  const initial = normalise(openF1Driver.first_name).slice(0, 1);
  const byName = archiveDrivers.filter(
    (driver) => normalise(driver.surname) === surname && normalise(driver.forename).startsWith(initial),
  );
  if (byName.length === 1) return byName[0];

  const exactRef = archiveDrivers.find(
    (driver) => driver.driverRef === `${normalise(openF1Driver.first_name)}_${surname}`,
  );
  return exactRef ?? null;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
function renderManifest({ drivers, teams, circuits, history, logos, credits }) {
  const record = (entries) =>
    Object.keys(entries).length
      ? `{\n${Object.entries(entries)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
          .join('\n')}\n}`
      : '{}';

  const creditsBlock = credits.length
    ? `[\n${credits
        .map(
          (item) =>
            `  { subject: ${JSON.stringify(item.subject)}, file: ${JSON.stringify(item.file)}, ` +
            `source: ${JSON.stringify(item.source)}, license: ${JSON.stringify(item.license)} },`,
        )
        .join('\n')}\n]`
    : '[]';

  return `/**
 * Generated by \`npm run assets:fetch\`. Do not edit by hand.
 *
 * Lists the local image files that actually exist, so components never request
 * a missing file. Anything absent falls back to a typographic crest.
 */
export const DRIVER_PHOTOS = new Set<string>([
${drivers.sort().map((ref) => `  ${JSON.stringify(ref)},`).join('\n')}
]);

export const TEAM_LOGOS: Record<string, string> = ${record(teams)};

export const CIRCUIT_MAPS: Record<string, string> = ${record(circuits)};

export const HISTORY_PHOTOS: Record<string, string> = ${record(history)};

export const BRAND_LOGO = ${logos.brand ? JSON.stringify(logos.brand) : 'null'};

export interface AssetCredit {
  subject: string;
  file: string;
  source: string;
  license: string;
}

export const ASSET_CREDITS: AssetCredit[] = ${creditsBlock};

export const ASSETS_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\nFetching F1 assets\n');

  const driverDir = path.join(IMAGE_ROOT, 'drivers');
  const teamDir = path.join(IMAGE_ROOT, 'teams');
  const circuitDir = path.join(IMAGE_ROOT, 'circuits');
  const historyDir = path.join(IMAGE_ROOT, 'history');
  const brandDir = path.join(IMAGE_ROOT, 'brand');
  await Promise.all([driverDir, teamDir, circuitDir, historyDir, brandDir].map((dir) => mkdir(dir, { recursive: true })));

  const credits = [];
  const archiveDrivers = await readArchive('drivers.csv');
  const archiveConstructors = await readArchive('constructors.csv');
  const archiveCircuits = await readArchive('circuits.csv');

  // -- Brand ---------------------------------------------------------------
  console.log('Brand');
  const brand = await download(commons(F1_LOGO.file, 600), brandDir, 'f1');
  if (brand) {
    credits.push({ subject: 'Formula 1 logo', file: brand, source: 'Wikimedia Commons', license: F1_LOGO.license });
    console.log(`  ok  brand/f1.${brand.split('.').pop()}`);
  }

  // -- Drivers -------------------------------------------------------------
  console.log('\nDrivers');
  const openF1Drivers = await collectOpenF1Drivers();
  const driverRefs = [];
  const unmatched = [];
  for (const driver of openF1Drivers) {
    const match = matchDriver(driver, archiveDrivers);
    if (!match) {
      unmatched.push(`${driver.first_name} ${driver.last_name}`);
      continue;
    }
    if (driverRefs.includes(match.driverRef)) continue;
    const saved = await download(driver.url, driverDir, match.driverRef, { minBytes: 2_000 });
    if (saved) driverRefs.push(match.driverRef);
  }
  console.log(`  ${driverRefs.length} portraits saved${unmatched.length ? ` · ${unmatched.length} outside the archive` : ''}`);

  // -- Teams ---------------------------------------------------------------
  console.log('\nTeams');
  const teams = {};
  for (const team of archiveConstructors) {
    const ref = team.constructorRef;
    let saved = null;

    if (TEAM_CDN[ref]) {
      const [year, slug] = TEAM_CDN[ref];
      saved = await download(F1_TEAMS(year, slug), teamDir, ref, { minBytes: 2_000 });
      if (saved) credits.push({ subject: team.name, file: `teams/${saved}`, source: `Formula 1 (${year})`, license: 'Official team mark' });
    }

    if (!saved && TEAM_WIKI[ref]) {
      for (const candidate of TEAM_WIKI[ref]) {
        const onWiki = candidate.startsWith('!');
        const file = onWiki ? candidate.slice(1) : candidate;
        const url = onWiki ? enwiki(file, 400) : commons(file, 400);
        saved = await download(url, teamDir, ref, { minBytes: 700 });
        if (saved) {
          credits.push({
            subject: team.name,
            file: `teams/${saved}`,
            source: onWiki ? 'English Wikipedia' : 'Wikimedia Commons',
            license: onWiki ? 'Fair use (team mark)' : 'See source page',
          });
          break;
        }
      }
    }

    if (saved) teams[ref] = saved;
  }
  const missingTeams = archiveConstructors.filter((team) => !teams[team.constructorRef]).map((team) => team.constructorRef);
  console.log(`  ${Object.keys(teams).length}/${archiveConstructors.length} logos`);
  if (missingTeams.length) console.log(`  crest fallback: ${missingTeams.join(', ')}`);

  // -- Circuits ------------------------------------------------------------
  console.log('\nCircuits');
  const circuitMaps = {};
  for (const circuit of archiveCircuits) {
    const ref = circuit.circuitRef;
    const source = CIRCUITS[ref];
    if (!source) {
      console.warn(`  ! ${ref}: no source configured`);
      continue;
    }

    let saved = null;
    if (source.cdn) {
      saved = await download(F1_CIRCUIT(source.cdn), circuitDir, ref, { minBytes: 5_000 });
      if (saved) credits.push({ subject: circuit.name, file: `circuits/${saved}`, source: 'Formula 1', license: 'Official circuit map' });
    }
    if (!saved && source.wiki) {
      const onWiki = source.wiki.startsWith('!');
      const file = onWiki ? source.wiki.slice(1) : source.wiki;
      saved = await download(onWiki ? enwiki(file, 1400) : commons(file, 1400), circuitDir, ref, { minBytes: 5_000 });
      if (saved) {
        credits.push({
          subject: circuit.name,
          file: `circuits/${saved}`,
          source: onWiki ? 'English Wikipedia' : 'Wikimedia Commons',
          license: 'CC BY-SA / public domain',
        });
      }
    }
    if (saved) circuitMaps[ref] = saved;
    else console.warn(`  ! ${ref}: download failed`);
  }
  console.log(`  ${Object.keys(circuitMaps).length}/${archiveCircuits.length} maps`);

  // -- History photography -------------------------------------------------
  console.log('\nHistory');
  const history = {};
  for (const [key, item] of Object.entries(HISTORY)) {
    const saved = await download(commons(item.file, 1600), historyDir, key, { minBytes: 8_000 });
    if (saved) {
      history[key] = saved;
      credits.push({ subject: key, file: `history/${saved}`, source: item.credit, license: item.license });
    } else {
      console.warn(`  ! ${key}: ${item.file}`);
    }
  }
  console.log(`  ${Object.keys(history).length}/${Object.keys(HISTORY).length} photos`);

  // -- Write manifest ------------------------------------------------------
  await writeFile(
    MANIFEST,
    renderManifest({
      drivers: driverRefs,
      teams,
      circuits: circuitMaps,
      history,
      logos: { brand },
      credits: credits.sort((a, b) => a.subject.localeCompare(b.subject)),
    }),
    'utf8',
  );

  console.log(`\nManifest: ${path.relative(ROOT, MANIFEST)}`);
  console.log(
    `Summary: ${driverRefs.length} drivers · ${Object.keys(teams).length} teams · ` +
      `${Object.keys(circuitMaps).length} circuits · ${Object.keys(history).length} history photos\n`,
  );

  if (missingTeams.length) {
    console.log(`${missingTeams.length} teams have no licensable logo and will render a crest.\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
