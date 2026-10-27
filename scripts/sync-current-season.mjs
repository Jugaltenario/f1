#!/usr/bin/env node
/**
 * Extends the bundled archive past the Ergast cutoff using Jolpica, the
 * community-maintained Ergast successor.
 *
 *   node scripts/sync-current-season.mjs
 *
 * Ergast stopped shipping fresh data after 2024, so `prune-archive.mjs` can only
 * ever produce a 2024 archive on its own. This script pulls every season from
 * 2025 to the current calendar year and appends it to the same CSVs, so the
 * frontend keeps one flat, streaming-friendly data source.
 *
 * The script is idempotent: it first removes every row belonging to a synced
 * season, then re-adds it. Running it twice produces byte-identical output
 * apart from `generatedAt`.
 *
 * Order matters — `npm run data:build` runs prune first, then this.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, toCsv, int, num, str } from './lib/csv.mjs';

const FIRST_YEAR = 2000;
const SYNC_FROM = 2025;
const LAST_YEAR = new Date().getFullYear();
const API = 'https://api.jolpi.ca/ergast/f1';
const PAGE = 100;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const target = join(root, 'frontend', 'src', 'assets', 'archive');

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------
function read(name) {
  const path = join(target, name);
  if (!existsSync(path)) throw new Error(`Missing archive file: ${path} (run prune-archive.mjs first)`);
  return parseCsv(readFileSync(path, 'utf8'));
}

function write(name, header, rows) {
  const csv = toCsv(header, rows);
  writeFileSync(join(target, name), csv, 'utf8');
  console.log(`  ${name.padEnd(34)} ${String(rows.length).padStart(6)} rows   ${(csv.length / 1024).toFixed(0).padStart(5)} kB`);
  return rows.length;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET with a small retry loop; Jolpica occasionally answers 429 under load. */
async function getJson(url, label) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.ok) return await response.json();
      if (response.status === 404) return null;
      if (response.status === 429) {
        const wait = Number(response.headers.get('retry-after')) || 3 * attempt;
        console.warn(`  ~ ${label}: rate limited, waiting ${wait}s`);
        await sleep(wait * 1_000);
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 5) throw new Error(`${label}: ${error.message}`);
      await sleep(800 * attempt);
    }
  }
  return null;
}

/** Jolpica caps `limit` at 100, so paginate and merge pages by round. */
async function getAllRounds(year, endpoint, listKey) {
  const merged = new Map();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const payload = await getJson(`${API}/${year}/${endpoint}.json?limit=${PAGE}&offset=${offset}`, `${year} ${endpoint}`);
    const data = payload?.MRData;
    if (!data) break;

    total = Number(data.total ?? 0);
    for (const race of data.RaceTable?.Races ?? []) {
      const round = Number(race.round);
      const bucket = merged.get(round) ?? { ...race, [listKey]: [] };
      bucket[listKey].push(...(race[listKey] ?? []));
      merged.set(round, bucket);
    }
    offset += Number(data.limit ?? PAGE);
    if (!data.RaceTable?.Races?.length) break;
    await sleep(120);
  }

  return [...merged.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

// ---------------------------------------------------------------------------
// Probe the season so we know how much has actually happened
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nSyncing ${SYNC_FROM}–${LAST_YEAR} from Jolpica\n`);

  // -------------------------------------------------------------------------
  // 1. Load the pruned archive and drop any previously synced seasons
  // -------------------------------------------------------------------------
  const racesTable = read('races.csv');
  const resultsTable = read('results.csv');
  const qualifyingTable = read('qualifying.csv');
  const driversTable = read('drivers.csv');
  const constructorsTable = read('constructors.csv');
  const circuitsTable = read('circuits.csv');
  const statusTable = read('status.csv');
  const standingsTable = read('season_standings.csv');
  const constructorStandingsTable = read('season_constructor_standings.csv');

  const baseRaces = racesTable.rows.filter((row) => int(row.year) < SYNC_FROM);
  const baseRaceIds = new Set(baseRaces.map((row) => row.raceId));
  const baseResults = resultsTable.rows.filter((row) => baseRaceIds.has(row.raceId));
  const baseQualifying = qualifyingTable.rows.filter((row) => baseRaceIds.has(row.raceId));
  const baseStandings = standingsTable.rows.filter((row) => int(row.year) < SYNC_FROM);
  const baseConstructorStandings = constructorStandingsTable.rows.filter((row) => int(row.year) < SYNC_FROM);

  // Keep only entities the remaining data still references.
  const usedDrivers = new Set([...baseResults, ...baseQualifying, ...baseStandings].map((row) => row.driverId));
  const usedConstructors = new Set(
    [...baseResults, ...baseQualifying, ...baseConstructorStandings].map((row) => row.constructorId),
  );
  const usedCircuits = new Set(baseRaces.map((row) => row.circuitId));
  const usedStatuses = new Set(baseResults.map((row) => row.statusId));

  const drivers = driversTable.rows.filter((row) => usedDrivers.has(row.driverId));
  const constructors = constructorsTable.rows.filter((row) => usedConstructors.has(row.constructorId));
  const circuits = circuitsTable.rows.filter((row) => usedCircuits.has(row.circuitId));
  const statuses = statusTable.rows.filter((row) => usedStatuses.has(row.statusId));

  const driverByRef = new Map(drivers.map((row) => [row.driverRef, row]));
  const constructorByRef = new Map(constructors.map((row) => [row.constructorRef, row]));
  const circuitByRef = new Map(circuits.map((row) => [row.circuitRef, row]));
  const statusByName = new Map(statuses.map((row) => [row.status, row]));

  let nextDriverId = Math.max(0, ...drivers.map((row) => int(row.driverId))) + 1;
  let nextConstructorId = Math.max(0, ...constructors.map((row) => int(row.constructorId))) + 1;
  let nextCircuitId = Math.max(0, ...circuits.map((row) => int(row.circuitId))) + 1;
  let nextStatusId = Math.max(0, ...statuses.map((row) => int(row.statusId))) + 1;
  let nextResultId = Math.max(0, ...baseResults.map((row) => int(row.resultId))) + 1;
  let nextQualifyId = Math.max(0, ...baseQualifying.map((row) => int(row.qualifyId))) + 1;

  // -------------------------------------------------------------------------
  // 2. Pull every synced season
  // -------------------------------------------------------------------------
  const races = [...baseRaces];
  const results = [...baseResults];
  const qualifying = [...baseQualifying];
  const standings = [...baseStandings];
  const constructorStandings = [...baseConstructorStandings];

  const completeYears = new Set();
  let latestRaceDate = '';

  for (let year = SYNC_FROM; year <= LAST_YEAR; year += 1) {
    const schedule = await getJson(`${API}/${year}.json?limit=100`, `${year} schedule`);
    const rounds = schedule?.MRData?.RaceTable?.Races ?? [];
    if (!rounds.length) {
      console.warn(`  ! ${year}: no schedule returned, skipping`);
      continue;
    }

    console.log(`  ${year}: ${rounds.length} scheduled rounds`);

    const raceResults = await getAllRounds(year, 'results', 'Results');
    const raceQualifying = await getAllRounds(year, 'qualifying', 'QualifyingResults');
    const resultsByRound = new Map(raceResults.map((race) => [Number(race.round), race.Results]));
    const qualifyingByRound = new Map(raceQualifying.map((race) => [Number(race.round), race.QualifyingResults]));

    // Standings give the authoritative points total (they include sprint points,
    // fastest-lap bonuses from older seasons and any post-race penalties).
    const driverStandingPayload = await getJson(
      `${API}/${year}/driverstandings.json?limit=100`,
      `${year} driver standings`,
    );
    const constructorStandingPayload = await getJson(
      `${API}/${year}/constructorstandings.json?limit=100`,
      `${year} constructor standings`,
    );
    const driverStandingList = driverStandingPayload?.MRData?.StandingsTable?.StandingsLists?.[0];
    const constructorStandingList = constructorStandingPayload?.MRData?.StandingsTable?.StandingsLists?.[0];

    const today = new Date().toISOString().slice(0, 10);
    let completedRounds = 0;

    for (const race of rounds) {
      const round = Number(race.round);
      const raceId = year * 100 + round; // stable synthetic id: Jolpica dropped raceId
      const circuitRef = race.Circuit?.circuitId;
      if (!circuitRef) continue;

      let circuit = circuitByRef.get(circuitRef);
      if (!circuit) {
        circuit = {
          circuitId: String(nextCircuitId++),
          circuitRef,
          name: str(race.Circuit.circuitName),
          location: str(race.Circuit.Location?.locality),
          country: str(race.Circuit.Location?.country),
          lat: str(race.Circuit.Location?.lat),
          lng: str(race.Circuit.Location?.long),
          alt: '',
          url: str(race.Circuit.url),
        };
        circuits.push(circuit);
        circuitByRef.set(circuitRef, circuit);
      }

      const sprint = race.Sprint ?? null;
      races.push({
        raceId: String(raceId),
        year: String(year),
        round: String(round),
        circuitId: circuit.circuitId,
        name: str(race.raceName),
        date: str(race.date),
        time: str(race.time).replace(/Z$/, ''),
        url: str(race.url),
        fp1_date: str(race.FirstPractice?.date, '\\N'),
        fp1_time: str(race.FirstPractice?.time, '\\N').replace(/Z$/, ''),
        fp2_date: str(race.SecondPractice?.date, '\\N'),
        fp2_time: str(race.SecondPractice?.time, '\\N').replace(/Z$/, ''),
        fp3_date: str(race.ThirdPractice?.date, '\\N'),
        fp3_time: str(race.ThirdPractice?.time, '\\N').replace(/Z$/, ''),
        quali_date: str(race.Qualifying?.date, '\\N'),
        quali_time: str(race.Qualifying?.time, '\\N').replace(/Z$/, ''),
        sprint_date: str(sprint?.date, '\\N'),
        sprint_time: str(sprint?.time, '\\N').replace(/Z$/, ''),
      });

      const roundResults = resultsByRound.get(round) ?? [];
      const roundQualifying = qualifyingByRound.get(round) ?? [];
      if (!roundResults.length) continue;

      completedRounds += 1;
      if (str(race.date) > latestRaceDate) latestRaceDate = str(race.date);

      // A driver can appear twice in one weekend only in the shared-drive era,
      // so guard against duplicate rows when merging paginated pages.
      const seenDrivers = new Set();

      roundResults.forEach((row, index) => {
        const driverRef = row.Driver?.driverId;
        const constructorRef = row.Constructor?.constructorId;
        if (!driverRef || !constructorRef || seenDrivers.has(driverRef)) return;
        seenDrivers.add(driverRef);

        let driver = driverByRef.get(driverRef);
        if (!driver) {
          driver = {
            driverId: String(nextDriverId++),
            driverRef,
            number: str(row.Driver.permanentNumber),
            code: str(row.Driver.code),
            forename: str(row.Driver.givenName),
            surname: str(row.Driver.familyName),
            dob: str(row.Driver.dateOfBirth),
            nationality: str(row.Driver.nationality),
            url: str(row.Driver.url),
          };
          drivers.push(driver);
          driverByRef.set(driverRef, driver);
        }

        let constructor = constructorByRef.get(constructorRef);
        if (!constructor) {
          constructor = {
            constructorId: String(nextConstructorId++),
            constructorRef,
            name: str(row.Constructor.name),
            nationality: str(row.Constructor.nationality),
            url: str(row.Constructor.url),
          };
          constructors.push(constructor);
          constructorByRef.set(constructorRef, constructor);
        }

        const statusName = str(row.status, 'Finished');
        let status = statusByName.get(statusName);
        if (!status) {
          status = { statusId: String(nextStatusId++), status: statusName };
          statuses.push(status);
          statusByName.set(statusName, status);
        }

        results.push({
          resultId: String(nextResultId++),
          raceId: String(raceId),
          driverId: driver.driverId,
          constructorId: constructor.constructorId,
          number: str(row.number),
          grid: str(row.grid),
          position: str(row.position, '\\N'),
          positionText: str(row.positionText),
          positionOrder: String(index + 1),
          points: str(row.points),
          laps: str(row.laps),
          time: str(row.Time?.time, '\\N'),
          milliseconds: str(row.Time?.millis, '\\N'),
          fastestLap: str(row.FastestLap?.lap, '\\N'),
          rank: str(row.FastestLap?.rank, '\\N'),
          fastestLapTime: str(row.FastestLap?.Time?.time, '\\N'),
          fastestLapSpeed: str(row.FastestLap?.AverageSpeed?.speed, '\\N'),
          statusId: status.statusId,
        });
      });

      const seenQualifying = new Set();
      for (const row of roundQualifying) {
        const driverRef = row.Driver?.driverId;
        const constructorRef = row.Constructor?.constructorId;
        if (!driverRef || !constructorRef || seenQualifying.has(driverRef)) continue;
        seenQualifying.add(driverRef);

        const driver = driverByRef.get(driverRef);
        const constructor = constructorByRef.get(constructorRef);
        if (!driver || !constructor) continue;

        qualifying.push({
          qualifyId: String(nextQualifyId++),
          raceId: String(raceId),
          driverId: driver.driverId,
          constructorId: constructor.constructorId,
          number: str(row.number),
          position: str(row.position),
          q1: str(row.Q1, '\\N'),
          q2: str(row.Q2, '\\N'),
          q3: str(row.Q3, '\\N'),
        });
      }
    }

    // A season is complete once the standings round matches the final round and
    // the last race date is in the past.
    const standingRound = Number(driverStandingList?.round ?? 0);
    const lastDate = rounds[rounds.length - 1]?.date ?? '';
    const seasonComplete = standingRound >= rounds.length && lastDate < today;
    if (seasonComplete) completeYears.add(year);

    console.log(
      `    ${completedRounds}/${rounds.length} rounds with results · ` +
        `standings at round ${standingRound || '—'} · ${seasonComplete ? 'complete' : 'in progress'}`,
    );

    // Final constructor a driver raced for in this season, used for standings rows.
    const lastConstructorByDriver = new Map();
    for (const row of results) {
      if (!String(row.raceId).startsWith(String(year))) continue;
      lastConstructorByDriver.set(row.driverId, row.constructorId);
    }

    for (const standing of driverStandingList?.DriverStandings ?? []) {
      const driverRef = standing.Driver?.driverId;
      const driver = driverByRef.get(driverRef);
      if (!driver) continue;
      standings.push({
        year: String(year),
        driverId: driver.driverId,
        position: str(standing.position),
        points: str(standing.points),
        wins: str(standing.wins),
        constructorId: lastConstructorByDriver.get(driver.driverId) ?? '',
      });
    }

    for (const standing of constructorStandingList?.ConstructorStandings ?? []) {
      const constructorRef = standing.Constructor?.constructorId;
      const constructor = constructorByRef.get(constructorRef);
      if (!constructor) continue;
      constructorStandings.push({
        year: String(year),
        constructorId: constructor.constructorId,
        position: str(standing.position),
        points: str(standing.points),
        wins: str(standing.wins),
      });
    }

    await sleep(200);
  }

  // -------------------------------------------------------------------------
  // 3. Write everything back
  // -------------------------------------------------------------------------
  console.log('\nWriting archive\n');

  const byId = (key) => (a, b) => int(a[key]) - int(b[key]);

  drivers.sort(byId('driverId'));
  constructors.sort(byId('constructorId'));
  circuits.sort(byId('circuitId'));
  statuses.sort(byId('statusId'));
  races.sort((a, b) => int(a.raceId) - int(b.raceId));
  results.sort((a, b) => int(a.resultId) - int(b.resultId));
  qualifying.sort((a, b) => int(a.qualifyId) - int(b.qualifyId));
  standings.sort((a, b) => int(a.year) - int(b.year) || int(a.position) - int(b.position));
  constructorStandings.sort((a, b) => int(a.year) - int(b.year) || int(a.position) - int(b.position));

  write('drivers.csv', ['driverId', 'driverRef', 'number', 'code', 'forename', 'surname', 'dob', 'nationality', 'url'], drivers);
  write('constructors.csv', ['constructorId', 'constructorRef', 'name', 'nationality', 'url'], constructors);
  write('circuits.csv', ['circuitId', 'circuitRef', 'name', 'location', 'country', 'lat', 'lng', 'alt', 'url'], circuits);
  write('races.csv', racesTable.header, races);
  write('results.csv', resultsTable.header, results);
  write('qualifying.csv', qualifyingTable.header, qualifying);
  write('status.csv', ['statusId', 'status'], statuses);
  write('season_standings.csv', ['year', 'driverId', 'position', 'points', 'wins', 'constructorId'], standings);
  write(
    'season_constructor_standings.csv',
    ['year', 'constructorId', 'position', 'points', 'wins'],
    constructorStandings,
  );

  const seasonYears = [...new Set(races.map((race) => int(race.year)))].sort((a, b) => a - b);
  const meta = {
    generatedAt: new Date().toISOString(),
    startYear: FIRST_YEAR,
    endYear: seasonYears[seasonYears.length - 1],
    dataThrough: new Date().toISOString().slice(0, 10),
    latestRaceDate,
    completeYears: seasonYears.filter((year) => year < SYNC_FROM || completeYears.has(year)),
    currentYear: LAST_YEAR,
    counts: {
      drivers: drivers.length,
      constructors: constructors.length,
      circuits: circuits.length,
      races: races.length,
      results: results.length,
      qualifying: qualifying.length,
      seasons: seasonYears.length,
    },
    source: {
      archive: 'Ergast (2000–2024)',
      current: 'Jolpica (2025–present)',
    },
  };
  writeFileSync(join(target, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  console.log(`\n  data through ${meta.dataThrough} (last race ${latestRaceDate})`);
  console.log(`  seasons ${meta.startYear}–${meta.endYear} · ${meta.counts.seasons} seasons`);
  console.log(`  complete seasons: ${meta.completeYears.length} · ${meta.endYear} is still running\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
