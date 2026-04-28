import { EnvironmentInjector, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Driver } from '../core/models/driver.model';

const API_URL = 'https://f1-mjj6.onrender.com/api';

export interface Constructor {
  constructorId: number;
  constructorRef: string;
  name: string;
  nationality: string;
  url: string;
}

export interface Circuit {
  circuitId: number;
  circuitRef: string;
  name: string;
  location: string;
  country: string;
  lat: number | null;
  lng: number | null;
  alt: number | null;
  url: string;
}

export interface Race {
  raceId: number;
  year: number;
  round: number;
  circuitId: number;
  name: string;
  date: string;
  time: string | null;
  url: string;
}

export interface Result {
  resultId: number;
  raceId: number;
  driverId: number;
  constructorId: number;
  number: number | null;
  grid: number;
  position: number | null;
  positionText: string;
  positionOrder: number;
  points: number;
  laps: number;
  time: string | null;
  milliseconds: number | null;
  fastestLap: number | null;
  rank: number | null;
  fastestLapTime: string | null;
  fastestLapSpeed: string | null;
  statusId: number;
  driver?: Driver;
  constructor?: Constructor;
}

@Injectable({
  providedIn: 'root'
})
export class F1ApiService {
  constructor(private http: HttpClient) {}

  getDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${API_URL}/drivers`);
  }

  getDriver(id: number): Observable<Driver> {
    return this.http.get<Driver>(`${API_URL}/drivers/${id}`);
  }

  getConstructors(): Observable<Constructor[]> {
    return this.http.get<Constructor[]>(`${API_URL}/constructors`);
  }

  getConstructor(id: number): Observable<Constructor> {
    return this.http.get<Constructor>(`${API_URL}/constructors/${id}`);
  }

  getCircuits(): Observable<Circuit[]> {
    return this.http.get<Circuit[]>(`${API_URL}/circuits`);
  }

  getCircuit(id: number): Observable<Circuit> {
    return this.http.get<Circuit>(`${API_URL}/circuits/${id}`);
  }

  getRaces(year?: number): Observable<Race[]> {
    if (year) {
      return this.http.get<Race[]>(`${API_URL}/races?year=${year}`);
    }
    return this.http.get<Race[]>(`${API_URL}/races`);
  }

  getRace(id: number): Observable<Race> {
    return this.http.get<Race>(`${API_URL}/races/${id}`);
  }

  getResults(raceId: number): Observable<Result[]> {
    return this.http.get<Result[]>(`${API_URL}/results/${raceId}`);
  }

  getLatestResults(): Observable<{ race: Race; results: Result[] }> {
    return this.http.get<{ race: Race; results: Result[] }>(`${API_URL}/latest-results`);
  }

  getChampions(): Observable<{ year: number; standings: any[] }> {
    return this.http.get<{ year: number; standings: any[] }>(`${API_URL}/champions`);
  }

  getDriverStats(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${API_URL}/drivers/stats`);
  }

  getDriverImage(driverRef: string): string {
    return `https://en.wikipedia.org/wiki/File:${driverRef}.jpg`;
  }

  getConstructorLogo(constructorRef: string): string {
    return `https://en.wikipedia.org/wiki/File:${constructorRef}_logo.png`;
  }

  getCircuitImage(circuitRef: string): string {
    return `https://en.wikipedia.org/wiki/File:${circuitRef}_circuit.png`;
  }
}