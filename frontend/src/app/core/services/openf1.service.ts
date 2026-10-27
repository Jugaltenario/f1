import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, shareReplay, firstValueFrom, forkJoin, map } from 'rxjs';

import {
  LiveDriverRow,
  OpenF1CarData,
  OpenF1ChampionshipDriver,
  OpenF1ChampionshipTeam,
  OpenF1Driver,
  OpenF1Interval,
  OpenF1Lap,
  OpenF1Location,
  OpenF1Meeting,
  OpenF1Pit,
  OpenF1Position,
  OpenF1RaceControl,
  OpenF1Session,
  OpenF1SessionResult,
  OpenF1Stint,
  OpenF1Weather,
} from '../models/openf1.model';

const BASE = 'https://api.openf1.org/v1';
const TOKEN_KEY = 'paddock.openf1.token';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Thin, cached client for OpenF1.
 *
 * OpenF1 allows 3 requests/second, so every call passes through a small token
 * bucket. Historical responses are immutable and cached forever; that keeps the
 * live page from hammering the API when the user flips between sessions.
 */
@Injectable({ providedIn: 'root' })
export class OpenF1Service {
  private http = inject(HttpClient);

  private readonly cache = new Map<string, Observable<unknown>>();

  /**
   * Optional OpenF1 bearer token. The free tier covers historical data, so the
   * app is fully usable without one; a paid token unlocks true real-time
   * polling (and is only ever sent to api.openf1.org).
   */
  private token: string | null = readStoredToken();

  // Token bucket: burst 3, then one token every ~340 ms (≈2.9 req/s).
  private tokens = 3;
  private lastRefill = Date.now();

  // ---------------------------------------------------------------------------
  // Authentication / cache control
  // ---------------------------------------------------------------------------
  get hasToken(): boolean {
    return !!this.token;
  }

  setToken(token: string | null): void {
    const next = token?.trim() || null;
    this.token = next;
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage may be unavailable; the token still works for this session.
    }
    this.cache.clear();
  }

  /** Drops cached responses for one session so polling sees fresh timing data. */
  clearSessionCache(sessionKey: number): void {
    for (const key of [...this.cache.keys()]) {
      if (key.includes(`:${sessionKey}`)) this.cache.delete(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------
  getSession(sessionKey: number): Observable<OpenF1Session[]> {
    return this.get<OpenF1Session[]>(`/sessions?session_key=${sessionKey}`, `session:${sessionKey}`);
  }

  getSessions(year?: number): Observable<OpenF1Session[]> {
    return this.get<OpenF1Session[]>(year ? `/sessions?year=${year}` : '/sessions', `sessions:${year ?? 'all'}`);
  }

  getMeetings(year: number): Observable<OpenF1Meeting[]> {
    return this.get<OpenF1Meeting[]>(`/meetings?year=${year}`, `meetings:${year}`);
  }

  getLatestSession(): Observable<OpenF1Session[]> {
    return this.get<OpenF1Session[]>('/sessions?session_key=latest', 'session:latest');
  }

  getDrivers(sessionKey: number): Observable<OpenF1Driver[]> {
    return this.get<OpenF1Driver[]>(`/drivers?session_key=${sessionKey}`, `drivers:${sessionKey}`).pipe(
      map((drivers) => drivers.slice().sort((a, b) => a.driver_number - b.driver_number)),
    );
  }

  // ---------------------------------------------------------------------------
  // Results / standings
  // ---------------------------------------------------------------------------
  getSessionResult(sessionKey: number): Observable<OpenF1SessionResult[]> {
    return this.get<OpenF1SessionResult[]>(`/session_result?session_key=${sessionKey}`, `result:${sessionKey}`);
  }

  getDriversChampionship(sessionKey: number): Observable<OpenF1ChampionshipDriver[]> {
    return this.get<OpenF1ChampionshipDriver[]>(
      `/championship_drivers?session_key=${sessionKey}`,
      `champ-drivers:${sessionKey}`,
    );
  }

  getTeamsChampionship(sessionKey: number): Observable<OpenF1ChampionshipTeam[]> {
    return this.get<OpenF1ChampionshipTeam[]>(
      `/championship_teams?session_key=${sessionKey}`,
      `champ-teams:${sessionKey}`,
    );
  }

  getStartingGrid(sessionKey: number): Observable<{ position: number; driver_number: number; lap_duration: number }[]> {
    return this.get(`/starting_grid?session_key=${sessionKey}`, `grid:${sessionKey}`);
  }

  // ---------------------------------------------------------------------------
  // Timing (all-driver endpoints — one request per table, never per driver)
  // ---------------------------------------------------------------------------
  getIntervals(sessionKey: number): Observable<OpenF1Interval[]> {
    return this.get<OpenF1Interval[]>(`/intervals?session_key=${sessionKey}`, `intervals:${sessionKey}`);
  }

  getPositions(sessionKey: number): Observable<OpenF1Position[]> {
    return this.get<OpenF1Position[]>(`/position?session_key=${sessionKey}`, `positions:${sessionKey}`);
  }

  getLaps(sessionKey: number, driverNumber?: number): Observable<OpenF1Lap[]> {
    const query = driverNumber
      ? `/laps?session_key=${sessionKey}&driver_number=${driverNumber}`
      : `/laps?session_key=${sessionKey}`;
    return this.get<OpenF1Lap[]>(query, `laps:${sessionKey}:${driverNumber ?? 'all'}`);
  }

  getStints(sessionKey: number): Observable<OpenF1Stint[]> {
    return this.get<OpenF1Stint[]>(`/stints?session_key=${sessionKey}`, `stints:${sessionKey}`);
  }

  getPitStops(sessionKey: number): Observable<OpenF1Pit[]> {
    return this.get<OpenF1Pit[]>(`/pit?session_key=${sessionKey}`, `pit:${sessionKey}`);
  }

  getRaceControl(sessionKey: number): Observable<OpenF1RaceControl[]> {
    return this.get<OpenF1RaceControl[]>(`/race_control?session_key=${sessionKey}`, `race-control:${sessionKey}`);
  }

  getWeather(sessionKey: number): Observable<OpenF1Weather[]> {
    return this.get<OpenF1Weather[]>(`/weather?session_key=${sessionKey}`, `weather:${sessionKey}`);
  }

  // ---------------------------------------------------------------------------
  // Telemetry (windowed — a full session is far too large)
  // ---------------------------------------------------------------------------
  getCarData(sessionKey: number, driverNumber: number, from: string, to: string): Observable<OpenF1CarData[]> {
    const query =
      `/car_data?session_key=${sessionKey}&driver_number=${driverNumber}` +
      `&date>=${encodeURIComponent(from)}&date<=${encodeURIComponent(to)}`;
    return this.get<OpenF1CarData[]>(query, `car:${sessionKey}:${driverNumber}:${from}:${to}`);
  }

  getLocation(sessionKey: number, driverNumber: number, from: string, to: string): Observable<OpenF1Location[]> {
    const query =
      `/location?session_key=${sessionKey}&driver_number=${driverNumber}` +
      `&date>=${encodeURIComponent(from)}&date<=${encodeURIComponent(to)}`;
    return this.get<OpenF1Location[]>(query, `loc:${sessionKey}:${driverNumber}:${from}:${to}`);
  }

  getLapTelemetry(
    sessionKey: number,
    driverNumber: number,
    from: string,
    to: string,
  ): Observable<{ car: OpenF1CarData[]; location: OpenF1Location[] }> {
    return forkJoin({
      car: this.getCarData(sessionKey, driverNumber, from, to),
      location: this.getLocation(sessionKey, driverNumber, from, to),
    });
  }

  // ---------------------------------------------------------------------------
  // Composed view for the live board
  // ---------------------------------------------------------------------------
  getLiveBoard(sessionKey: number): Observable<{
    drivers: OpenF1Driver[];
    rows: LiveDriverRow[];
    laps: OpenF1Lap[];
    raceControl: OpenF1RaceControl[];
    weather: OpenF1Weather | null;
    result: OpenF1SessionResult[];
  }> {
    return forkJoin({
      drivers: this.getDrivers(sessionKey),
      intervals: this.getIntervals(sessionKey),
      positions: this.getPositions(sessionKey),
      laps: this.getLaps(sessionKey),
      stints: this.getStints(sessionKey),
      pit: this.getPitStops(sessionKey),
      raceControl: this.getRaceControl(sessionKey),
      weather: this.getWeather(sessionKey),
      result: this.getSessionResult(sessionKey),
    }).pipe(
      map(({ drivers, intervals, positions, laps, stints, pit, raceControl, weather, result }) => {
        const rows = buildLiveRows(drivers, intervals, positions, laps, stints, pit, result);
        return {
          drivers,
          rows,
          laps,
          raceControl: raceControl.slice(-40).reverse(),
          weather: weather[weather.length - 1] ?? null,
          result,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Plumbing
  // ---------------------------------------------------------------------------
  private get<T>(path: string, key: string): Observable<T> {
    const cached = this.cache.get(key);
    if (cached) return cached as Observable<T>;

    const request = new Observable<T>((subscriber) => {
      let cancelled = false;

      this.acquire().then(() => {
        if (cancelled) return;

        const headers = this.token
          ? new HttpHeaders({ Authorization: `Bearer ${this.token}` })
          : undefined;

        firstValueFrom(this.http.get<T>(`${BASE}${path}`, { headers }))
          .then((data) => {
            if (cancelled) return;
            subscriber.next(data);
            subscriber.complete();
          })
          .catch((err) => {
            if (cancelled) return;
            subscriber.error(err);
          });
      });

      return () => {
        cancelled = true;
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: false }));

    this.cache.set(key, request as Observable<unknown>);
    return request;
  }

  private async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      if (elapsed > 0) {
        this.tokens = Math.min(3, this.tokens + elapsed / 340);
        this.lastRefill = now;
      }
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
  }
}

// ---------------------------------------------------------------------------
// Live board assembly
// ---------------------------------------------------------------------------
function latestBy<T>(rows: T[], key: (row: T) => number): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) map.set(key(row), row);
  return map;
}

function buildLiveRows(
  drivers: OpenF1Driver[],
  intervals: OpenF1Interval[],
  positions: OpenF1Position[],
  laps: OpenF1Lap[],
  stints: OpenF1Stint[],
  pits: OpenF1Pit[],
  results: OpenF1SessionResult[],
): LiveDriverRow[] {
  const latestInterval = latestBy(intervals, (row) => row.driver_number);
  const latestPosition = latestBy(positions, (row) => row.driver_number);
  const latestResult = latestBy(results, (row) => row.driver_number);

  const rows: LiveDriverRow[] = drivers.map((driver) => {
    const number = driver.driver_number;
    const driverLaps = laps.filter((lap) => lap.driver_number === number && lap.lap_duration !== null);
    const driverStints = stints
      .filter((stint) => stint.driver_number === number)
      .sort((a, b) => a.stint_number - b.stint_number);
    const driverPits = pits.filter((pit) => pit.driver_number === number);

    const interval = latestInterval.get(number);
    const position = latestPosition.get(number)?.position ?? latestResult.get(number)?.position ?? 99;
    const bestLap = driverLaps.reduce<number | null>(
      (best, lap) => (lap.lap_duration !== null && (best === null || lap.lap_duration < best) ? lap.lap_duration : best),
      null,
    );
    const lastLap = driverLaps[driverLaps.length - 1]?.lap_duration ?? null;

    return {
      position,
      driver,
      interval: interval?.interval ?? null,
      gap: interval?.gap_to_leader ?? null,
      laps: driverLaps.reduce((max, lap) => Math.max(max, lap.lap_number), 0),
      stint: driverStints[driverStints.length - 1] ?? null,
      lastLap,
      bestLap,
      pitStops: driverPits.length,
      color: `#${driver.team_colour || '8b8f98'}`,
      inPit: driverPits.some((pit) => pit.lap_number === Math.max(...driverPits.map((p) => p.lap_number), 0)),
    };
  });

  return rows.sort((a, b) => a.position - b.position);
}
