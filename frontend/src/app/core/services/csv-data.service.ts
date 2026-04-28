import { Injectable, inject, signal, computed, isDevMode, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Papa } from 'ngx-papaparse';
import { Observable, map, catchError, of, forkJoin, tap, finalize } from 'rxjs';
import {
  Driver, Season, Race, Result, Constructor,
  DriverStanding, Qualifying, ChampionshipStanding, RivalryData, SeasonStanding
} from '../models/driver.model';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  data?: any;
}

@Injectable({ providedIn: 'root' })
export class CSVDataService {
  private http = inject(HttpClient);
  private papa = new Papa();
  private zone = inject(NgZone);

  private archivePath = '/assets/archive/';  
  private logBuffer: LogEntry[] = [];
  private readonly MAX_LOG_BUFFER = 100;
  
  // Cache to avoid multiple HTTP requests
  private cache = new Map<string, any>();
  private cachePromises = new Map<string, Observable<any>>();

  private log(level: LogEntry['level'], message: string, context?: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data
    };
    
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    const prefix = `[${entry.timestamp}] [${level.toUpperCase().padEnd(5)}]`;
    const contextStr = context ? ` [${context}]` : '';

    switch (level) {
      case 'error':
        console.error(`${prefix}${contextStr} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix}${contextStr} ${message}`, data || '');
        break;
      case 'debug':
        if (isDevMode()) {
          console.debug(`${prefix}${contextStr} ${message}`, data || '');
        }
        break;
      default:
        console.log(`${prefix}${contextStr} ${message}`, data || '');
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogs(): void {
    this.logBuffer = [];
    this.log('info', 'Log buffer cleared', 'CSVDataService');
  }

  private logRequest(path: string, method: string = 'GET') {
    this.log('debug', `HTTP ${method} request: ${path}`, 'CSVDataService');
  }

  private logResponse(path: string, status: 'success' | 'error', data?: any, error?: any) {
    if (status === 'success') {
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      this.log('info', `HTTP success: ${path} (${count} items)`, 'CSVDataService', { count });
    } else {
      this.log('error', `HTTP error: ${path}`, 'CSVDataService', { error: error?.message || error });
    }
  }

  getDrivers(): Observable<Driver[]> {
    const path = `${this.archivePath}drivers.csv`;
    this.logRequest(path);
    
    return this.parseCSV<any>(path, 'Drivers').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      map(rows => {
        const drivers: Driver[] = rows.map((row: any) => ({
          ...row,
          id: row.driverId || 0,
          driverId: row.driverId,
          number: row.number === '\\N' ? null : String(row.number),
          code: row.code || null,
          forename: row.forename || '',
          surname: row.surname || '',
          driverRef: row.driverRef || '',
          nationality: row.nationality || '',
          dob: row.dob || null,
          url: row.url || ''
        }));
        
        this.log('debug', `Parsed ${drivers.length} drivers`, 'CSVDataService');
        return drivers;
      }),
      catchError(err => {
        this.log('error', 'Failed to load drivers', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getSeasons(): Observable<Season[]> {
    const path = `${this.archivePath}seasons.csv`;
    this.logRequest(path);
    
    return this.parseCSV<Season>(path, 'Seasons').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load seasons', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getRaces(year?: number): Observable<Race[]> {
    const path = `${this.archivePath}races.csv`;
    this.logRequest(path);
    
    return this.parseCSV<Race>(path, 'Races').pipe(
      map(races => year ? races.filter(r => r.year === year) : races),
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load races', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getLatestResults(): Observable<{ race: Race; results: (Result & { driver?: Driver; constructor?: Constructor })[] }> {
    this.log('info', 'Loading latest results...', 'CSVDataService');
    
    return forkJoin({
      races: this.getRaces(),
      results: this.getResults(),
      drivers: this.getDrivers(),
      constructors: this.getConstructors()
    }).pipe(
      map(({ races, results, drivers, constructors }) => {
        const latestRace = races.reduce((latest, race) => {
          return new Date(race.date) > new Date(latest.date) ? race : latest;
        }, races[0]);
        
        if (!latestRace) {
          return { race: null as any, results: [] };
        }
        
        const raceResults = results
          .filter(r => r.raceId === latestRace.raceId)
          .sort((a: any, b: any) => a.positionOrder - b.positionOrder);
        
        const populatedResults = raceResults.map((result: any) => {
          const driver = drivers.find(d => d.driverId === result.driverId);
          const constructor = constructors.find(c => c.constructorId === result.constructorId);
          return { ...result, driver, constructor };
        });
        
        return { race: latestRace, results: populatedResults };
      }),
      catchError(err => {
        this.log('error', 'Failed to load latest results', 'CSVDataService', { error: err.message || err });
        return of({ race: null as any, results: [] });
      })
    );
  }

  getChampions(): Observable<{ year: number; standings: any[] }> {
    this.log('info', 'Loading champions...', 'CSVDataService');
    
    return forkJoin({
      races: this.getRaces(),
      standings: this.getDriverStandings(),
      drivers: this.getDrivers()
    }).pipe(
      map(({ races, standings, drivers }) => {
        const latestRace = races.reduce((latest, race) => {
          return new Date(race.date) > new Date(latest.date) ? race : latest;
        }, races[0]);
        
        if (!latestRace) {
          return { year: new Date().getFullYear(), standings: [] };
        }
        
        const year = latestRace.year;
        const latestStandings = standings
          .filter(s => s.raceId === latestRace.raceId)
          .sort((a: any, b: any) => a.position - b.position)
          .slice(0, 10);
        
        const populatedStandings = latestStandings.map((standing: any) => {
          const driver = drivers.find(d => d.driverId === standing.driverId);
          return { ...standing, driver };
        });
        
        return { year, standings: populatedStandings };
      }),
      catchError(err => {
        this.log('error', 'Failed to load champions', 'CSVDataService', { error: err.message || err });
        return of({ year: new Date().getFullYear(), standings: [] });
      })
    );
  }

  getResults(): Observable<Result[]> {
    const path = `${this.archivePath}results.csv`;
    this.logRequest(path);
    
    return this.parseCSV<any>(path, 'Results').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      map(rows => {
        const results = rows.map((row: any) => ({
          ...row,
          number: row.number === '\\N' ? null : String(row.number)
        }));
        
        this.log('debug', `Parsed ${results.length} results`, 'CSVDataService');
        return results;
      }),
      catchError(err => {
        this.log('error', 'Failed to load results', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getConstructors(): Observable<Constructor[]> {
    const path = `${this.archivePath}constructors.csv`;
    this.logRequest(path);
    
    return this.parseCSV<Constructor>(path, 'Constructors').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load constructors', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getDriverStandings(): Observable<DriverStanding[]> {
    const path = `${this.archivePath}driver_standings.csv`;
    this.logRequest(path);
    
    return this.parseCSV<DriverStanding>(path, 'DriverStandings').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load driver standings', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getQualifying(): Observable<Qualifying[]> {
    const path = `${this.archivePath}qualifying.csv`;
    this.logRequest(path);
    
    return this.parseCSV<Qualifying>(path, 'Qualifying').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load qualifying', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getCircuits(): Observable<any[]> {
    const path = `${this.archivePath}circuits.csv`;
    this.logRequest(path);
    
    return this.parseCSV<any>(path, 'Circuits').pipe(
      tap({
        next: (data) => this.logResponse(path, 'success', data),
        error: (err) => this.logResponse(path, 'error', null, err)
      }),
      catchError(err => {
        this.log('error', 'Failed to load circuits', 'CSVDataService', { error: err.message || err });
        return of([]);
      })
    );
  }

  getDriverStats(): Observable<Driver[]> {
    this.log('info', 'Loading driver stats (all data merge)...', 'CSVDataService');
    const startTime = Date.now();

    return forkJoin({
      drivers: this.getDrivers(),
      results: this.getResults(),
      races: this.getRaces(),
      standings: this.getDriverStandings(),
      qualifying: this.getQualifying()
    }).pipe(
      map(({ drivers, results, races, standings, qualifying }) => {
        const raceMap = new Map(races.map(r => [r.raceId, r]));
        
        const processedDrivers = drivers.map(driver => {
          const driverId = driver.driverId;
          const driverResults = results.filter(r => r.driverId === driverId);
          const driverRaces = races.filter(r => r.year >= 2009);
          
          const firstRace = driverRaces.find(r => 
            driverResults.some(dr => dr.raceId === r.raceId)
          );
          
          return {
            ...driver,
            debutYear: firstRace?.year || driverRaces[0]?.year,
            wins: driverResults.filter(r => r.position === 1).length,
            podiums: driverResults.filter(r => r.position && r.position <= 3).length,
            championships: new Set(driverResults.map(r => raceMap.get(r.raceId)?.year).filter(Boolean)).size
          };
        });

        const qualifyingPolePositions = new Map<number, number>();
        qualifying.forEach(q => {
          if (q.driverId && q.position === 1) {
            qualifyingPolePositions.set(q.driverId, (qualifyingPolePositions.get(q.driverId) || 0) + 1);
          }
        });

        processedDrivers.forEach(driver => {
          const driverId = driver.driverId || 0;
          const poles = qualifyingPolePositions.get(driverId);
          if (poles) {
            (driver as any).poles = poles;
          }
        });

        const duration = Date.now() - startTime;
        this.log('info', `Driver stats computed: ${processedDrivers.length} drivers in ${duration}ms`, 'CSVDataService', {
          drivers: processedDrivers.length,
          results: results.length,
          races: races.length,
          qualifying: qualifying.length,
          duration: `${duration}ms`
        });

        return processedDrivers;
      }),
      catchError(err => {
        this.log('error', 'Failed to load driver stats', 'CSVDataService', { error: err.message || err, stack: err.stack });
        return of([]);
      })
    );
  }

  getRivalryData(driver1Id: number, driver2Id: number): Observable<{ driver1: RivalryData; driver2: RivalryData } | null> {
    this.log('info', `Computing rivalry data: Driver ${driver1Id} vs Driver ${driver2Id}`, 'CSVDataService');
    const startTime = Date.now();

    return forkJoin({
      drivers: this.getDrivers(),
      results: this.getResults(),
      races: this.getRaces(),
      standings: this.getDriverStandings(),
      qualifying: this.getQualifying()
    }).pipe(
      map(({ drivers, results, races, standings, qualifying }) => {
        const raceMap = new Map(races.map(r => [r.raceId, r]));
        
        const buildRivalryData = (driverId: number): RivalryData => {
          const driver = drivers.find(d => d.driverId === driverId);
          const driverResults = results.filter(r => r.driverId === driverId);
          const driverQualifying = qualifying.filter(q => q.driverId === driverId);
          
          const yearlyStats = new Map<number, SeasonStanding>();
          
          driverResults.forEach(result => {
            const race = raceMap.get(result.raceId);
            if (!race) return;
            
            if (!yearlyStats.has(race.year)) {
              yearlyStats.set(race.year, {
                year: race.year,
                position: 0,
                points: 0,
                wins: 0,
                podiums: 0,
                poles: 0
              });
            }
            
            const stat = yearlyStats.get(race.year)!;
            stat.points += result.points || 0;
            if (result.position === 1) stat.wins++;
            if (result.position && result.position <= 3) stat.podiums++;
          });

          driverQualifying.forEach(q => {
            const race = raceMap.get(q.raceId);
            if (!race) return;
            
            const stat = yearlyStats.get(race.year);
            if (stat && q.position === 1) stat.poles++;
          });

          standings.forEach(s => {
            const race = raceMap.get(s.raceId);
            if (!race || s.driverId !== driverId) return;
            
            const stat = yearlyStats.get(race.year);
            if (stat) stat.position = s.position;
          });

          const sortedYears = Array.from(yearlyStats.values()).sort((a, b) => a.year - b.year);
          
          return {
            driverId,
            driverName: driver ? `${driver.forename} ${driver.surname}` : 'Unknown',
            standings: sortedYears
          };
        };

        const data = {
          driver1: buildRivalryData(driver1Id),
          driver2: buildRivalryData(driver2Id)
        };

        const duration = Date.now() - startTime;
        this.log('info', `Rivalry data computed in ${duration}ms`, 'CSVDataService', {
          driver1: data.driver1.driverName,
          driver2: data.driver2.driverName,
          seasons: data.driver1.standings.length + data.driver2.standings.length,
          duration: `${duration}ms`
        });

        return data;
      }),
      tap({
        error: (err) => this.log('error', 'Failed to compute rivalry data', 'CSVDataService', { 
          error: err.message || err,
          driver1Id,
          driver2Id
        })
      }),
      catchError(err => {
        this.log('error', 'Rivalry computation failed', 'CSVDataService', { 
          error: err.message || err,
          stack: err.stack 
        });
        return of(null);
      })
    );
  }

  getAllData(): Observable<{
    drivers: Driver[];
    seasons: Season[];
    races: Race[];
    constructors: Constructor[];
  }> {
    this.log('info', 'Loading all data...', 'CSVDataService');
    const startTime = Date.now();

    return forkJoin({
      drivers: this.getDriverStats(),
      seasons: this.getSeasons(),
      races: this.getRaces(),
      constructors: this.getConstructors()
    }).pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.log('info', `All data loaded in ${duration}ms`, 'CSVDataService', {
            drivers: data.drivers.length,
            seasons: data.seasons.length,
            races: data.races.length,
            constructors: data.constructors.length,
            duration: `${duration}ms`
          });
        },
        error: (err) => {
          this.log('error', 'Failed to load all data', 'CSVDataService', { error: err.message || err });
        }
      }),
      catchError(err => {
        this.log('error', 'Failed to load all data', 'CSVDataService', { error: err.message || err, stack: err.stack });
        return of({ drivers: [], seasons: [], races: [], constructors: [] });
      })
    );
  }

  private parseCSV<T>(path: string, label: string): Observable<T[]> {
    // Return cached data if available
    if (this.cache.has(path)) {
      this.log('debug', `Using cached CSV: ${path}`, label);
      return of(this.cache.get(path) as T[]);
    }

    // Return existing promise if already loading
    if (this.cachePromises.has(path)) {
      this.log('debug', `Using existing request: ${path}`, label);
      return this.cachePromises.get(path) as Observable<T[]>;
    }

    this.log('debug', `Parsing CSV: ${path}`, label);

    const request = new Observable<T[]>(subscriber => {
      const startTime = Date.now();

      this.http.get(path, { responseType: 'text' }).subscribe({
        next: (csv) => {
          this.log('debug', `CSV file received: ${path} (${csv.length} chars)`, label, {
            size: `${(csv.length / 1024).toFixed(2)} KB`
          });

          this.papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
              const duration = Date.now() - startTime;
              
              if (results.errors && results.errors.length > 0) {
                this.log('warn', `CSV parsing completed with errors`, label, {
                  errorCount: results.errors.length,
                  errors: results.errors.slice(0, 5)
                });
              }

              this.log('debug', `CSV parsed: ${path}`, label, {
                rowCount: results.data.length,
                duration: `${duration}ms`
              });

              // Cache the results
              this.cache.set(path, results.data);
              this.cachePromises.delete(path);

              // Run in Angular zone to trigger change detection
              this.zone.run(() => {
                subscriber.next(results.data as T[]);
                subscriber.complete();
              });
            },
            error: (error: any) => {
              const duration = Date.now() - startTime;
              this.log('error', `CSV parse error: ${path}`, label, {
                error: error.message,
                duration: `${duration}ms`
              });
              this.cachePromises.delete(path);
              this.zone.run(() => {
                subscriber.error(error);
              });
            }
          });
        },
        error: (error: HttpErrorResponse) => {
          const duration = Date.now() - startTime;
          
          let errorMessage = `HTTP ${error.status}`;
          if (error.status === 0) {
            errorMessage = 'Network error - CORS or server not running';
          } else if (error.status === 404) {
            errorMessage = `File not found: ${path}`;
          } else if (error.status >= 500) {
            errorMessage = `Server error: ${error.status}`;
          }

          this.log('error', `CSV load failed: ${path}`, label, {
            error: errorMessage,
            status: error.status,
            statusText: error.statusText,
            duration: `${duration}ms`
          });

          this.cachePromises.delete(path);
          subscriber.error(new Error(errorMessage));
        }
      });
    });

    this.cachePromises.set(path, request);
    return request;
  }
}