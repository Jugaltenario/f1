import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Papa } from 'ngx-papaparse';
import { Observable, forkJoin, of, map, shareReplay, catchError, tap, finalize } from 'rxjs';

import {
  ArchiveMeta,
  ChampionRow,
  Circuit,
  CircuitCareer,
  Constructor,
  ConstructorCareer,
  Driver,
  DriverCareer,
  DriverSeasonRow,
  EnrichedResult,
  Qualifying,
  Race,
  RaceWithResults,
  Result,
  RivalryData,
  SeasonConstructorStanding,
  SeasonStanding,
  SeasonSummary,
  StandingsRow,
  Status,
} from '../models/driver.model';
import { ARCHIVE_END_YEAR, teamColor as teamColorFor } from '../config/data.config';
import { colorFromId, hexAlpha } from '../utils/format';

const ARCHIVE = '/assets/archive/';

interface CoreData {
  meta: ArchiveMeta | null;
  drivers: Driver[];
  driverById: Map<number, Driver>;
  constructors: Constructor[];
  constructorById: Map<number, Constructor>;
  circuits: Circuit[];
  circuitById: Map<number, Circuit>;
  races: Race[];
  raceById: Map<number, Race>;
  yearOfRace: Map<number, number>;
  results: Result[];
  resultsByRace: Map<number, Result[]>;
  resultsByDriver: Map<number, Result[]>;
  qualifying: Qualifying[];
  qualifyingByRace: Map<number, Qualifying[]>;
  qualifyingByDriver: Map<number, Qualifying[]>;
  standings: SeasonStanding[];
  standingsByDriver: Map<number, SeasonStanding[]>;
  constructorStandings: SeasonConstructorStanding[];
  constructorStandingsByConstructor: Map<number, SeasonConstructorStanding[]>;
  statusById: Map<number, string>;
  driverCareers: DriverCareer[];
  constructorCareers: ConstructorCareer[];
  circuitCareers: CircuitCareer[];
  /** Most recent race that actually has results. */
  latestRace: Race | null;
  /** Next race on the calendar without results, if any. */
  nextRace: Race | null;
  roundsByYear: Map<number, Race[]>;
  completeYears: Set<number>;
}

@Injectable({ providedIn: 'root' })
export class CSVDataService {
  private http = inject(HttpClient);
  private papa = inject(Papa);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private cache = new Map<string, Observable<unknown[]>>();

  /** The whole archive, parsed and indexed exactly once. */
  private core$: Observable<CoreData> = forkJoin({
    meta: this.loadJson<ArchiveMeta>('meta.json'),
    drivers: this.load('drivers.csv'),
    constructors: this.load('constructors.csv'),
    circuits: this.load('circuits.csv'),
    races: this.load('races.csv'),
    results: this.load('results.csv'),
    qualifying: this.load('qualifying.csv'),
    status: this.load('status.csv'),
    standings: this.load('season_standings.csv'),
    constructorStandings: this.load('season_constructor_standings.csv'),
  }).pipe(
    map((raw) => this.build(raw as never)),
    tap((core) => {
      this.loading.set(false);
      this.error.set(null);
      if (typeof console !== 'undefined') {
        console.info(
          `[archive] ${core.driverCareers.length} drivers · ${core.constructorCareers.length} teams · ` +
            `${core.races.length} races · ${core.results.length} results`,
        );
      }
    }),
    catchError((err) => {
      this.loading.set(false);
      this.error.set(err?.message ?? 'Unable to load the archive');
      console.error('[archive] failed to load', err);
      return of(this.buildEmpty());
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  // -------------------------------------------------------------------------
  // Public reads
  // -------------------------------------------------------------------------
  getMeta(): Observable<ArchiveMeta | null> {
    return this.core$.pipe(map((core) => core.meta));
  }

  getDrivers(): Observable<DriverCareer[]> {
    return this.core$.pipe(map((core) => core.driverCareers));
  }

  getDriver(driverId: number): Observable<DriverCareer | null> {
    return this.core$.pipe(
      map((core) => core.driverCareers.find((driver) => driver.driverId === driverId) ?? null),
    );
  }

  getConstructors(): Observable<ConstructorCareer[]> {
    return this.core$.pipe(map((core) => core.constructorCareers));
  }

  getCircuits(): Observable<CircuitCareer[]> {
    return this.core$.pipe(map((core) => core.circuitCareers));
  }

  getRaces(year?: number): Observable<Race[]> {
    return this.core$.pipe(
      map((core) =>
        (year ? core.races.filter((race) => race.year === year) : core.races)
          .slice()
          .sort((a, b) => b.year - a.year || a.round - b.round),
      ),
    );
  }

  getSeasons(): Observable<number[]> {
    return this.core$.pipe(
      map((core) => [...new Set(core.races.map((race) => race.year))].sort((a, b) => b - a)),
    );
  }

  getSeasonStandings(year: number): Observable<StandingsRow[]> {
    return this.core$.pipe(
      map((core) =>
        core.standings
          .filter((row) => row.year === year)
          .sort((a, b) => a.position - b.position)
          .map((row) => {
            const driver = core.driverById.get(row.driverId);
            const constructor = core.constructorById.get(row.constructorId);
            return {
              position: row.position,
              points: row.points,
              wins: row.wins,
              driver,
              constructor,
              teamColor: teamColorFor(constructor?.constructorRef),
            };
          }),
      ),
    );
  }

  getConstructorStandings(year: number): Observable<(SeasonConstructorStanding & { constructor?: Constructor; color: string })[]> {
    return this.core$.pipe(
      map((core) =>
        core.constructorStandings
          .filter((row) => row.year === year)
          .sort((a, b) => a.position - b.position)
          .map((row) => {
            const constructor = core.constructorById.get(row.constructorId);
            return { ...row, constructor, color: teamColorFor(constructor?.constructorRef) };
          }),
      ),
    );
  }

  getRace(raceId: number): Observable<RaceWithResults | null> {
    return this.core$.pipe(map((core) => this.buildRace(core, raceId)));
  }

  getLatestRace(): Observable<RaceWithResults | null> {
    return this.core$.pipe(map((core) => (core.latestRace ? this.buildRace(core, core.latestRace.raceId) : null)));
  }

  /**
   * Calendar + championship state for one season. The live season reports its
   * leader and how many rounds remain; it never reports a champion.
   */
  getSeasonSummary(year: number): Observable<SeasonSummary> {
    return this.core$.pipe(map((core) => this.buildSeasonSummary(core, year)));
  }

  getCurrentSeason(): Observable<SeasonSummary> {
    return this.core$.pipe(map((core) => this.buildSeasonSummary(core, core.meta?.endYear ?? ARCHIVE_END_YEAR)));
  }

  getDriverSeasons(driverId: number): Observable<DriverSeasonRow[]> {
    return this.core$.pipe(map((core) => this.buildDriverSeasons(core, driverId)));
  }

  getRivalry(driver1Id: number, driver2Id: number): Observable<{ driver1: RivalryData; driver2: RivalryData }> {
    return this.core$.pipe(
      map((core) => ({
        driver1: this.buildRivalry(core, driver1Id),
        driver2: this.buildRivalry(core, driver2Id),
      })),
    );
  }

  getChampions(): Observable<ChampionRow[]> {
    return this.core$.pipe(
      map((core) => {
        const rows: ChampionRow[] = [];
        for (const standing of core.standings) {
          if (standing.position !== 1) continue;
          // The in-progress season has a leader, not a champion.
          if (!core.completeYears.has(standing.year)) continue;
          const constructor = core.constructorById.get(standing.constructorId);
          rows.push({
            year: standing.year,
            driver: core.driverById.get(standing.driverId) ?? null,
            constructor: constructor ?? null,
            teamColor: teamColorFor(constructor?.constructorRef),
            points: standing.points,
            wins: standing.wins,
          });
        }
        return rows.sort((a, b) => b.year - a.year);
      }),
    );
  }

  /** Everything the home page needs in a single subscription. */
  getOverview(): Observable<{
    meta: ArchiveMeta | null;
    season: SeasonSummary;
    champions: ChampionRow[];
    totals: { races: number; drivers: number; constructors: number; circuits: number };
  }> {
    return this.core$.pipe(
      map((core) => {
        const year = core.meta?.endYear ?? ARCHIVE_END_YEAR;
        const champions: ChampionRow[] = [];
        for (const standing of core.standings) {
          if (standing.position !== 1 || !core.completeYears.has(standing.year)) continue;
          const constructor = core.constructorById.get(standing.constructorId);
          champions.push({
            year: standing.year,
            driver: core.driverById.get(standing.driverId) ?? null,
            constructor: constructor ?? null,
            teamColor: teamColorFor(constructor?.constructorRef),
            points: standing.points,
            wins: standing.wins,
          });
        }

        return {
          meta: core.meta,
          season: this.buildSeasonSummary(core, year),
          champions: champions.sort((a, b) => b.year - a.year),
          totals: {
            races: core.races.length,
            drivers: core.drivers.length,
            constructors: core.constructors.length,
            circuits: core.circuits.length,
          },
        };
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  private loadJson<T>(file: string): Observable<T | null> {
    return this.http.get<T>(`${ARCHIVE}${file}`).pipe(catchError(() => of(null)));
  }

  private load<T>(file: string): Observable<T[]> {
    const path = `${ARCHIVE}${file}`;
    const cached = this.cache.get(path);
    if (cached) return cached as Observable<T[]>;

    const request = this.http.get(path, { responseType: 'text' }).pipe(
      map((csv) => this.parseCsv<T>(csv, file)),
      catchError((err) => {
        console.error(`[archive] ${file} failed`, err);
        this.error.set(`Could not load ${file}`);
        return of([] as T[]);
      }),
      finalize(() => this.cache.delete(path)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(path, request as Observable<unknown[]>);
    return request;
  }

  private parseCsv<T>(csv: string, label: string): T[] {
    let rows: T[] = [];
    try {
      this.papa.parse(csv, {
        header: true,
        skipEmptyLines: 'greedy',
        dynamicTyping: true,
        complete: (result) => {
          rows = (result.data ?? []).filter(Boolean) as T[];
        },
      });
    } catch (err) {
      console.error(`[archive] ${label} parse error`, err);
      return [];
    }
    return rows;
  }

  // -------------------------------------------------------------------------
  // Indexing
  // -------------------------------------------------------------------------
  private build(raw: {
    meta: ArchiveMeta | null;
    drivers: Record<string, unknown>[];
    constructors: Record<string, unknown>[];
    circuits: Record<string, unknown>[];
    races: Record<string, unknown>[];
    results: Record<string, unknown>[];
    qualifying: Record<string, unknown>[];
    status: Record<string, unknown>[];
    standings: Record<string, unknown>[];
    constructorStandings: Record<string, unknown>[];
  }): CoreData {
    const drivers: Driver[] = raw.drivers.map((row) => ({
      driverId: num(row['driverId']),
      driverRef: text(row['driverRef']),
      number: numOrNull(row['number']),
      code: text(row['code']) || null,
      forename: text(row['forename']),
      surname: text(row['surname']),
      dob: text(row['dob']) || null,
      nationality: text(row['nationality']).trim(),
      url: text(row['url']),
    }));

    const constructors: Constructor[] = raw.constructors.map((row) => ({
      constructorId: num(row['constructorId']),
      constructorRef: text(row['constructorRef']),
      name: text(row['name']),
      nationality: text(row['nationality']).trim(),
      url: text(row['url']),
    }));

    const circuits: Circuit[] = raw.circuits.map((row) => ({
      circuitId: num(row['circuitId']),
      circuitRef: text(row['circuitRef']),
      name: text(row['name']),
      location: text(row['location']),
      country: text(row['country']),
      lat: numOrNull(row['lat']),
      lng: numOrNull(row['lng']),
      alt: numOrNull(row['alt']),
      url: text(row['url']),
    }));

    const races: Race[] = raw.races
      .map((row) => ({
        raceId: num(row['raceId']),
        year: num(row['year']),
        round: num(row['round']),
        circuitId: num(row['circuitId']),
        name: text(row['name']),
        date: text(row['date']),
        time: text(row['time']) || null,
        url: text(row['url']),
      }))
      .sort((a, b) => a.raceId - b.raceId);

    const results: Result[] = raw.results.map((row) => ({
      resultId: num(row['resultId']),
      raceId: num(row['raceId']),
      driverId: num(row['driverId']),
      constructorId: num(row['constructorId']),
      number: numOrNull(row['number']),
      grid: num(row['grid']),
      position: numOrNull(row['position']),
      positionText: text(row['positionText']),
      positionOrder: num(row['positionOrder']),
      points: num(row['points']),
      laps: num(row['laps']),
      time: text(row['time']) || null,
      milliseconds: numOrNull(row['milliseconds']),
      fastestLap: numOrNull(row['fastestLap']),
      rank: numOrNull(row['rank']),
      fastestLapTime: text(row['fastestLapTime']) || null,
      fastestLapSpeed: text(row['fastestLapSpeed']) || null,
      statusId: num(row['statusId']),
    }));

    const qualifying: Qualifying[] = raw.qualifying.map((row) => ({
      qualifyId: num(row['qualifyId']),
      raceId: num(row['raceId']),
      driverId: num(row['driverId']),
      constructorId: num(row['constructorId']),
      number: numOrNull(row['number']),
      position: num(row['position']),
      q1: text(row['q1']) || null,
      q2: text(row['q2']) || null,
      q3: text(row['q3']) || null,
    }));

    const standings: SeasonStanding[] = raw.standings.map((row) => ({
      year: num(row['year']),
      driverId: num(row['driverId']),
      position: num(row['position']),
      points: num(row['points']),
      wins: num(row['wins']),
      constructorId: num(row['constructorId']),
    }));

    const constructorStandings: SeasonConstructorStanding[] = raw.constructorStandings.map((row) => ({
      year: num(row['year']),
      constructorId: num(row['constructorId']),
      position: num(row['position']),
      points: num(row['points']),
      wins: num(row['wins']),
    }));

    const driverById = new Map(drivers.map((driver) => [driver.driverId, driver]));
    const constructorById = new Map(constructors.map((constructor) => [constructor.constructorId, constructor]));
    const circuitById = new Map(circuits.map((circuit) => [circuit.circuitId, circuit]));
    const raceById = new Map(races.map((race) => [race.raceId, race]));
    const yearOfRace = new Map(races.map((race) => [race.raceId, race.year]));
    const statusById = new Map(raw.status.map((row) => [num(row['statusId']), text(row['status'])]));

    const resultsByRace = groupBy(results, (row) => row.raceId);
    const resultsByDriver = groupBy(results, (row) => row.driverId);
    const qualifyingByRace = groupBy(qualifying, (row) => row.raceId);
    const qualifyingByDriver = groupBy(qualifying, (row) => row.driverId);
    const standingsByDriver = groupBy(standings, (row) => row.driverId);
    const constructorStandingsByConstructor = groupBy(constructorStandings, (row) => row.constructorId);

    const core: CoreData = {
      meta: raw.meta,
      drivers,
      driverById,
      constructors,
      constructorById,
      circuits,
      circuitById,
      races,
      raceById,
      yearOfRace,
      results,
      resultsByRace,
      resultsByDriver,
      qualifying,
      qualifyingByRace,
      qualifyingByDriver,
      standings,
      standingsByDriver,
      constructorStandings,
      constructorStandingsByConstructor,
      statusById,
      driverCareers: [],
      constructorCareers: [],
      circuitCareers: [],
      latestRace: null,
      nextRace: null,
      roundsByYear: new Map(),
      completeYears: new Set(),
    };

    // A race counts as run when it has results. The 2026 calendar is bundled in
    // full, so "latest race" must never mean "last round in the file".
    const hasResults = (race: Race) => (resultsByRace.get(race.raceId)?.length ?? 0) > 0;
    const today = new Date().toISOString().slice(0, 10);
    const completed = races.filter(hasResults);

    core.latestRace = completed.length ? completed[completed.length - 1] : null;
    core.nextRace =
      races.find((race) => !hasResults(race) && race.date >= today) ??
      races.find((race) => !hasResults(race)) ??
      null;

    const years = [...new Set(races.map((race) => race.year))];
    for (const year of years) {
      core.roundsByYear.set(
        year,
        races.filter((race) => race.year === year),
      );
    }

    // Trust meta.json: it knows which championships are actually decided and
    // therefore which seasons may be labelled "champion".
    const declared = raw.meta?.completeYears ?? [];
    for (const year of years) {
      const complete = declared.length
        ? declared.includes(year)
        : year < (raw.meta?.endYear ?? ARCHIVE_END_YEAR);
      if (complete) core.completeYears.add(year);
    }

    core.driverCareers = this.buildDriverCareers(core);
    core.constructorCareers = this.buildConstructorCareers(core);
    core.circuitCareers = this.buildCircuitCareers(core);
    return core;
  }

  private buildDriverCareers(core: CoreData): DriverCareer[] {
    const latestYear = core.meta?.endYear ?? ARCHIVE_END_YEAR;

    return core.drivers
      .map((driver) => {
        const results = (core.resultsByDriver.get(driver.driverId) ?? []).slice().sort((a, b) => a.raceId - b.raceId);
        const qualifying = core.qualifyingByDriver.get(driver.driverId) ?? [];
        const standings = core.standingsByDriver.get(driver.driverId) ?? [];

        const years = [...new Set(results.map((row) => core.yearOfRace.get(row.raceId)).filter(isNumber))].sort(
          (a, b) => a - b,
        );

        const lastResult = results[results.length - 1];
        const lastConstructor = lastResult ? core.constructorById.get(lastResult.constructorId) : undefined;
        const ref = lastConstructor?.constructorRef;

        return {
          ...driver,
          wins: results.filter((row) => row.position === 1).length,
          podiums: results.filter((row) => row.position !== null && row.position <= 3).length,
          poles: qualifying.filter((row) => row.position === 1).length,
          championships: standings.filter((row) => row.position === 1).length,
          starts: results.length,
          points: round(results.reduce((sum, row) => sum + row.points, 0)),
          debutYear: years[0] ?? null,
          lastYear: years[years.length - 1] ?? null,
          seasonsCount: years.length,
          teamRef: ref ?? '',
          teamName: lastConstructor?.name ?? '—',
          teamColor: teamColorFor(ref),
          active: years.length > 0 && years[years.length - 1] >= latestYear,
        } satisfies DriverCareer;
      })
      .sort((a, b) => b.championships - a.championships || b.wins - a.wins || b.podiums - a.podiums);
  }

  private buildConstructorCareers(core: CoreData): ConstructorCareer[] {
    const latestYear = core.meta?.endYear ?? ARCHIVE_END_YEAR;

    return core.constructors
      .map((constructor) => {
        const results = core.results.filter((row) => row.constructorId === constructor.constructorId);
        const standings = core.constructorStandingsByConstructor.get(constructor.constructorId) ?? [];
        const years = [...new Set(results.map((row) => core.yearOfRace.get(row.raceId)).filter(isNumber))].sort(
          (a, b) => a - b,
        );
        const drivers = new Set(results.map((row) => row.driverId));

        return {
          ...constructor,
          wins: results.filter((row) => row.position === 1).length,
          podiums: results.filter((row) => row.position !== null && row.position <= 3).length,
          championships: standings.filter((row) => row.position === 1).length,
          starts: results.length,
          points: round(results.reduce((sum, row) => sum + row.points, 0)),
          firstYear: years[0] ?? null,
          lastYear: years[years.length - 1] ?? null,
          seasonsCount: years.length,
          driversCount: drivers.size,
          color: teamColorFor(constructor.constructorRef),
          active: years.length > 0 && years[years.length - 1] >= latestYear,
          championYears: standings
            .filter((row) => row.position === 1)
            .map((row) => row.year)
            .sort((a, b) => a - b),
          drivers: [...drivers]
            .map((id) => core.driverById.get(id))
            .filter((driver): driver is Driver => !!driver)
            .sort((a, b) => a.surname.localeCompare(b.surname)),
        } satisfies ConstructorCareer;
      })
      .sort((a, b) => b.championships - a.championships || b.wins - a.wins || b.podiums - a.podiums);
  }

  private buildCircuitCareers(core: CoreData): CircuitCareer[] {
    return core.circuits
      .map((circuit) => {
        const races = core.races.filter((race) => race.circuitId === circuit.circuitId);
        const years = [...new Set(races.map((race) => race.year))].sort((a, b) => a - b);
        return {
          ...circuit,
          races: races.length,
          firstYear: years[0] ?? null,
          lastYear: years[years.length - 1] ?? null,
          color: colorFromId(circuit.circuitId),
        } satisfies CircuitCareer;
      })
      .sort((a, b) => b.races - a.races || a.name.localeCompare(b.name));
  }

  private buildSeasonSummary(core: CoreData, year: number): SeasonSummary {
    const races = core.roundsByYear.get(year) ?? [];
    const hasResults = (race: Race) => (core.resultsByRace.get(race.raceId)?.length ?? 0) > 0;
    const completedRaces = races.filter(hasResults);
    const latest = completedRaces.length ? completedRaces[completedRaces.length - 1] : null;
    const next = races.find((race) => !hasResults(race)) ?? null;
    const complete = core.completeYears.has(year);

    const standings = core.standings
      .filter((row) => row.year === year)
      .sort((a, b) => a.position - b.position)
      .map((row) => {
        const driver = core.driverById.get(row.driverId);
        const constructor = core.constructorById.get(row.constructorId);
        return {
          position: row.position,
          points: row.points,
          wins: row.wins,
          driver,
          constructor,
          teamColor: teamColorFor(constructor?.constructorRef),
        } satisfies StandingsRow;
      });

    const constructorStandings = core.constructorStandings
      .filter((row) => row.year === year)
      .sort((a, b) => a.position - b.position)
      .map((row) => {
        const constructor = core.constructorById.get(row.constructorId);
        return { ...row, constructor, color: teamColorFor(constructor?.constructorRef) };
      });

    return {
      year,
      complete,
      roundsTotal: races.length,
      roundsCompleted: completedRaces.length,
      standings,
      constructorStandings,
      leader: standings[0] ?? null,
      champion: complete ? standings[0] ?? null : null,
      latestRace: latest ? this.buildRace(core, latest.raceId) : null,
      nextRace: next
        ? { race: next, circuit: core.circuitById.get(next.circuitId) ?? null, complete: false }
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Derived views
  // -------------------------------------------------------------------------
  private buildRace(core: CoreData, raceId: number): RaceWithResults | null {
    const race = core.raceById.get(raceId);
    if (!race) return null;

    const results: EnrichedResult[] = (core.resultsByRace.get(raceId) ?? [])
      .slice()
      .sort((a, b) => a.positionOrder - b.positionOrder)
      .map((row) => this.enrichRow(core, row));

    const podium = results.filter((row) => row.position !== null && row.position <= 3).slice(0, 3);

    const fastestLap =
      results
        .filter((row) => row.fastestLapTime)
        .sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99))[0] ?? null;

    const qualifying = (core.qualifyingByRace.get(raceId) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        ...row,
        driver: core.driverById.get(row.driverId),
        constructor: core.constructorById.get(row.constructorId),
      }));

    return {
      race,
      circuit: core.circuitById.get(race.circuitId) ?? null,
      results,
      podium,
      fastestLap,
      qualifying,
    };
  }

  private enrichRow(core: CoreData, row: Result): EnrichedResult {
    const constructor = core.constructorById.get(row.constructorId) ?? null;
    return {
      ...row,
      driver: core.driverById.get(row.driverId) ?? null,
      constructor,
      status: core.statusById.get(row.statusId) ?? '',
      teamColor: teamColorFor(constructor?.constructorRef),
    };
  }

  private buildDriverSeasons(core: CoreData, driverId: number): DriverSeasonRow[] {
    const standings = core.standingsByDriver.get(driverId) ?? [];
    const results = core.resultsByDriver.get(driverId) ?? [];
    const qualifying = core.qualifyingByDriver.get(driverId) ?? [];

    return standings
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((standing) => {
        const seasonResults = results.filter((row) => core.yearOfRace.get(row.raceId) === standing.year);
        const seasonQualifying = qualifying.filter((row) => core.yearOfRace.get(row.raceId) === standing.year);
        const constructor = core.constructorById.get(standing.constructorId);
        return {
          year: standing.year,
          position: standing.position,
          points: standing.points,
          wins: seasonResults.filter((row) => row.position === 1).length,
          podiums: seasonResults.filter((row) => row.position !== null && row.position <= 3).length,
          poles: seasonQualifying.filter((row) => row.position === 1).length,
          races: seasonResults.length,
          teamRef: constructor?.constructorRef ?? '',
          teamName: constructor?.name ?? '—',
          teamColor: teamColorFor(constructor?.constructorRef),
        } satisfies DriverSeasonRow;
      });
  }

  private buildRivalry(core: CoreData, driverId: number): RivalryData {
    const driver = core.driverById.get(driverId) ?? null;
    const lastResult = (core.resultsByDriver.get(driverId) ?? []).slice(-1)[0];
    const constructor = lastResult ? core.constructorById.get(lastResult.constructorId) : undefined;

    return {
      driverId,
      driver,
      driverName: driver ? `${driver.forename} ${driver.surname}` : 'Unknown driver',
      teamColor: teamColorFor(constructor?.constructorRef),
      seasons: this.buildDriverSeasons(core, driverId).map((season) => ({
        year: season.year,
        position: season.position,
        points: season.points,
        wins: season.wins,
        podiums: season.podiums,
        poles: season.poles,
      })),
    };
  }

  private buildEmpty(): CoreData {
    return {
      meta: null,
      drivers: [],
      driverById: new Map(),
      constructors: [],
      constructorById: new Map(),
      circuits: [],
      circuitById: new Map(),
      races: [],
      raceById: new Map(),
      yearOfRace: new Map(),
      results: [],
      resultsByRace: new Map(),
      resultsByDriver: new Map(),
      qualifying: [],
      qualifyingByRace: new Map(),
      qualifyingByDriver: new Map(),
      standings: [],
      standingsByDriver: new Map(),
      constructorStandings: [],
      constructorStandingsByConstructor: new Map(),
      statusById: new Map(),
      driverCareers: [],
      constructorCareers: [],
      circuitCareers: [],
      latestRace: null,
      nextRace: null,
      roundsByYear: new Map(),
      completeYears: new Set(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const id = key(item);
    const bucket = map.get(id);
    if (bucket) bucket.push(item);
    else map.set(id, [item]);
  }
  return map;
}

export { colorFromId, hexAlpha };
