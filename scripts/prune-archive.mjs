#!/usr/bin/env node
/**
 * Builds the browser-facing archive from `backend/archive`.
 *
 * The app only ever shows 2000 → present, so shipping 1950s data (and the 17 MB
 * lap_times dump) is dead weight. This script:
 *   1. filters every table to the 2000+ seasons,
 *   2. drops rows nothing references (old drivers/teams/circuits),
 *   3. derives compact season-standings tables,
 *   4. writes meta.json the UI can use for provenance.
 *
 * Run with: npm run data:prune
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const START_YEAR = 2000;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = join(root, 'backend', 'archive');
const target = join(root, 'frontend', 'src', 'assets', 'archive');

// ---------------------------------------------------------------------------
// Minimal CSV parse/serialise (handles quoted fields, escaped quotes, CRLF)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return {
    header,
    rows: body
      .filter((cells) => cells.length === header.length)
      .map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i]]))),
  };
}

function toCsv(header, rows) {
  const escape = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(text) || /^\s|\s$/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [header.join(','), ...rows.map((row) => header.map((key) => escape(row[key])).join(','))].join('\n') + '\n';
}

function load(name) {
  const path = join(source, name);
  if (!existsSync(path)) throw new Error(`Missing source file: ${path}`);
  return parseCsv(readFileSync(path, 'utf8'));
}

function write(name, header, rows, stats, key) {
  const csv = toCsv(header, rows);
  writeFileSync(join(target, name), csv, 'utf8');
  stats[key] = rows.length;
  console.log(`  ${name.padEnd(34)} ${String(rows.length).padStart(6)} rows   ${(csv.length / 1024).toFixed(0).padStart(5)} kB`);
}

const num = (value) => (value === '' || value === undefined || value === '\\N' ? null : Number(value));
const str = (value) => (value === '\\N' ? '' : value);

// ---------------------------------------------------------------------------
// Load + filter
// ---------------------------------------------------------------------------
console.log(`\nPruning archive to ${START_YEAR}+  (${source})\n`);
if (existsSync(target)) rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const racesRaw = load('races.csv');
const races = racesRaw.rows
  .filter((race) => num(race.year) >= START_YEAR)
  .map((race) => ({ ...race, year: num(race.year) }));
const raceIds = new Set(races.map((race) => race.raceId));
const yearOfRace = new Map(races.map((race) => [race.raceId, race.year]));

console.log(`  filter: ${racesRaw.rows.length} → ${races.length} races`);

const resultsRaw = load('results.csv');
const results = resultsRaw.rows
  .filter((row) => raceIds.has(row.raceId) && num(row.driverId) !== null)
  .map((row) => ({ ...row, year: yearOfRace.get(row.raceId) }));

const qualifyingRaw = load('qualifying.csv');
const qualifying = qualifyingRaw.rows
  .filter((row) => raceIds.has(row.raceId) && num(row.driverId) !== null)
  .map((row) => ({ ...row, year: yearOfRace.get(row.raceId) }));

const driverStandingsRaw = load('driver_standings.csv');
const driverStandings = driverStandingsRaw.rows.filter(
  (row) => raceIds.has(row.raceId) && num(row.driverId) !== null,
);

const constructorStandingsRaw = load('constructor_standings.csv');
const constructorStandings = constructorStandingsRaw.rows.filter(
  (row) => raceIds.has(row.raceId) && num(row.constructorId) !== null,
);

// ---------------------------------------------------------------------------
// Referenced entities only
// ---------------------------------------------------------------------------
const driverIds = new Set();
for (const row of results) driverIds.add(row.driverId);
for (const row of qualifying) driverIds.add(row.driverId);
for (const row of driverStandings) driverIds.add(row.driverId);

const constructorIds = new Set();
for (const row of results) constructorIds.add(row.constructorId);
for (const row of qualifying) constructorIds.add(row.constructorId);
for (const row of constructorStandings) constructorIds.add(row.constructorId);

const circuitIds = new Set(races.map((race) => race.circuitId));

const drivers = load('drivers.csv').rows
  .filter((row) => driverIds.has(row.driverId))
  .map((row) => ({
    ...row,
    number: row.number === '\\N' ? '' : row.number,
    code: str(row.code),
    dob: str(row.dob),
  }));

const constructors = load('constructors.csv').rows.filter((row) => constructorIds.has(row.constructorId));
const circuits = load('circuits.csv').rows.filter((row) => circuitIds.has(row.circuitId));

const statusIds = new Set(results.map((row) => row.statusId));
const status = load('status.csv').rows.filter((row) => statusIds.has(row.statusId));

// ---------------------------------------------------------------------------
// Derived: final standings per season (one row per driver / team)
// ---------------------------------------------------------------------------
function lastRowPerSeason(rows, idKey, mapId) {
  const best = new Map();
  for (const row of rows) {
    const year = yearOfRace.get(row.raceId);
    const id = mapId(row);
    if (!year || !id) continue;
    const key = `${year}:${id}`;
    const current = best.get(key);
    if (!current || Number(row.raceId) > Number(current.row.raceId)) {
      best.set(key, { year, id, row });
    }
  }
  return [...best.values()];
}

// Constructor a driver finished the season with (last race they entered).
const lastConstructorBySeason = new Map();
for (const row of results) {
  const year = yearOfRace.get(row.raceId);
  const key = `${year}:${row.driverId}`;
  const current = lastConstructorBySeason.get(key);
  if (!current || Number(row.raceId) > Number(current.raceId)) {
    lastConstructorBySeason.set(key, { raceId: row.raceId, constructorId: row.constructorId });
  }
}

const driverSeasonRows = lastRowPerSeason(
  driverStandings,
  'driverId',
  (row) => row.driverId,
)
  .map(({ year, id }) => {
    const standing = driverStandings
      .filter((row) => row.driverId === id && yearOfRace.get(row.raceId) === year)
      .sort((a, b) => Number(b.raceId) - Number(a.raceId))[0];

    return {
      year: String(year),
      driverId: id,
      position: standing.position,
      points: standing.points,
      wins: standing.wins,
      constructorId: lastConstructorBySeason.get(`${year}:${id}`)?.constructorId ?? '',
    };
  })
  .sort((a, b) => Number(a.year) - Number(b.year) || Number(a.position) - Number(b.position));

const constructorSeasonRows = lastRowPerSeason(
  constructorStandings,
  'constructorId',
  (row) => row.constructorId,
)
  .map(({ year, id }) => {
    const standing = constructorStandings
      .filter((row) => row.constructorId === id && yearOfRace.get(row.raceId) === year)
      .sort((a, b) => Number(b.raceId) - Number(a.raceId))[0];

    return {
      year: String(year),
      constructorId: id,
      position: standing.position,
      points: standing.points,
      wins: standing.wins,
    };
  })
  .sort((a, b) => Number(a.year) - Number(b.year) || Number(a.position) - Number(b.position));

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
const stats = {};
const raceHeader = racesRaw.header;

write('drivers.csv', ['driverId', 'driverRef', 'number', 'code', 'forename', 'surname', 'dob', 'nationality', 'url'], drivers, stats, 'drivers');
write('constructors.csv', ['constructorId', 'constructorRef', 'name', 'nationality', 'url'], constructors, stats, 'constructors');
write('circuits.csv', ['circuitId', 'circuitRef', 'name', 'location', 'country', 'lat', 'lng', 'alt', 'url'], circuits, stats, 'circuits');
write('races.csv', raceHeader, races, stats, 'races');
write('results.csv', resultsRaw.header, results.map(({ year, ...row }) => row), stats, 'results');
write('qualifying.csv', qualifyingRaw.header, qualifying.map(({ year, ...row }) => row), stats, 'qualifying');
write('status.csv', ['statusId', 'status'], status, stats, 'status');
write('season_standings.csv', ['year', 'driverId', 'position', 'points', 'wins', 'constructorId'], driverSeasonRows, stats, 'driverSeasons');
write('season_constructor_standings.csv', ['year', 'constructorId', 'position', 'points', 'wins'], constructorSeasonRows, stats, 'constructorSeasons');

const meta = {
  generatedAt: new Date().toISOString(),
  startYear: START_YEAR,
  endYear: Math.max(...races.map((race) => race.year)),
  counts: {
    drivers: drivers.length,
    constructors: constructors.length,
    circuits: circuits.length,
    races: races.length,
    results: results.length,
    qualifying: qualifying.length,
    seasons: new Set(races.map((race) => race.year)).size,
  },
};
writeFileSync(join(target, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

const totalKb = [
  'drivers.csv', 'constructors.csv', 'circuits.csv', 'races.csv', 'results.csv',
  'qualifying.csv', 'status.csv', 'season_standings.csv', 'season_constructor_standings.csv',
].reduce((sum, file) => sum + readFileSync(join(target, file)).length, 0) / 1024;

console.log(`\n  archive total: ${(totalKb / 1024).toFixed(2)} MB across ${meta.counts.seasons} seasons`);
console.log(`  seasons ${meta.startYear}–${meta.endYear} · ${meta.counts.drivers} drivers · ${meta.counts.constructors} teams · ${meta.counts.races} races\n`);
