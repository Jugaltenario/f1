import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  ChampionRow,
  CircuitCareer,
  Race,
  RaceWithResults,
} from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { ARCHIVE_END_YEAR, OPENF1_START_YEAR } from '../../core/config/data.config';
import { countryFlag, countryCode } from '../../core/utils/country';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

interface SeasonRace {
  race: Race;
  detail: RaceWithResults;
}

@Component({
  selector: 'app-races',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    PageHeaderComponent,
    DriverAvatarComponent,
    TeamBadgeComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page races-page">
      <app-page-header
        eyebrow="Calendar · 2000 → {{ archiveEnd }}"
        title="Races"
        subtitle="Every round of every season in the archive, with the winner, the podium and a full classification one click away."
      >
        <div class="year-control panel">
          <button type="button" class="year-control__step" aria-label="Previous season" [disabled]="!canStep(-1)" (click)="step(-1)">←</button>
          <div class="field year-control__select">
            <select [value]="year()" (change)="onYearChange($event)" aria-label="Season">
              @for (y of years(); track y) {
                <option [value]="y">{{ y }} season</option>
              }
            </select>
          </div>
          <button type="button" class="year-control__step" aria-label="Next season" [disabled]="!canStep(1)" (click)="step(1)">→</button>
        </div>
      </app-page-header>

      <div class="year-rail" role="tablist" aria-label="Season selector">
        @for (y of years(); track y) {
          <button
            type="button"
            role="tab"
            class="year-chip"
            [class.is-active]="y === year()"
            [attr.aria-selected]="y === year()"
            (click)="selectYear(y)"
          >
            {{ y }}
          </button>
        }
      </div>

      @if (loading()) {
        <app-skeleton-loader [count]="6" [height]="120" />
      } @else {
        <!-- ------------------------------------------------------ season summary -->
        <section class="season-summary panel">
          <div class="season-summary__block season-summary__block--champion">
            <span class="eyebrow">Champion</span>
            @if (seasonChampion()?.driver; as driver) {
              <a class="champion-link" [routerLink]="'/drivers'" [queryParams]="{ driver: driver.driverId }">
                <app-driver-avatar
                  [forename]="driver.forename"
                  [surname]="driver.surname"
                  [driverRef]="driver.driverRef"
                  [color]="seasonChampion()?.teamColor ?? '#e10600'"
                  size="sm"
                />
                <span>
                  <strong>{{ driver.forename }} {{ driver.surname }}</strong>
                  <small>{{ seasonChampion()?.constructor?.name }} · {{ seasonChampion()?.points }} pts</small>
                </span>
              </a>
            }
          </div>

          <div class="season-summary__block">
            <span class="eyebrow">Rounds</span>
            <strong class="display">{{ races().length }}</strong>
          </div>

          <div class="season-summary__block">
            <span class="eyebrow">Different winners</span>
            <strong class="display">{{ winnersCount() }}</strong>
          </div>

          <div class="season-summary__block">
            <span class="eyebrow">Countries</span>
            <strong class="display">{{ countryCount() }}</strong>
          </div>

          <div class="season-summary__actions">
            @if (year() >= openF1Start) {
              <a class="btn btn--sm" routerLink="/live" [queryParams]="{ year: year() }">OpenF1 replay</a>
            }
            <a class="btn btn--primary btn--sm" routerLink="/standings" [queryParams]="{ year: year() }">Standings</a>
          </div>
        </section>

        <!-- ------------------------------------------------------------- filters -->
        <section class="toolbar panel">
          <label class="field toolbar__search">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path d="m12.5 12.5 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <input
              type="search"
              [value]="search()"
              (input)="onSearch($event)"
              placeholder="Search races, circuits or countries…"
              aria-label="Search races"
            />
          </label>

          <div class="field toolbar__select">
            <select [value]="circuitFilter() ?? 'all'" (change)="onCircuitChange($event)" aria-label="Filter by circuit">
              <option value="all">All circuits</option>
              @for (circuit of seasonCircuits(); track circuit.circuitId) {
                <option [value]="circuit.circuitRef">{{ circuit.name }}</option>
              }
            </select>
          </div>

          @if (circuitFilter()) {
            <button type="button" class="btn btn--ghost btn--sm" (click)="clearCircuit()">
              Clear circuit filter
            </button>
          }
        </section>

        <div class="results-line">
          <span class="muted">
            <strong>{{ filtered().length }}</strong> of {{ races().length }} rounds
            @if (filteredCircuitName()) {
              · at {{ filteredCircuitName() }}
            }
          </span>
        </div>

        @if (!filtered().length) {
          <app-empty-state
            icon="🏁"
            title="No races match those filters"
            message="Try a different search term or remove the circuit filter."
            actionLabel="Back to the calendar"
            actionLink="/races"
          />
        } @else {
          <div class="race-grid">
            @for (item of filtered(); track item.race.raceId) {
              <a class="race-card-link" [routerLink]="['/races', item.race.raceId]">
                <app-panel variant="default" [interactive]="true" [accent]="item.detail.podium[0]?.teamColor ?? '#e10600'">
                  <article class="race-tile">
                    <div class="race-tile__hero" [style.--race-color]="item.detail.podium[0]?.teamColor ?? '#8b8f98'">
                      <span class="race-tile__flag" aria-hidden="true">{{ flag(item.detail.circuit?.country ?? '') }}</span>
                      <span class="race-tile__round">Round {{ item.race.round }}</span>
                      <span class="race-tile__date">{{ item.race.date | date: 'd MMM' }}</span>
                    </div>

                    <div class="race-tile__body">
                      <h3>{{ item.race.name }}</h3>
                      <span class="race-tile__circuit">
                        {{ item.detail.circuit?.name }} · {{ item.detail.circuit?.location }}
                      </span>

                      @if (item.detail.podium[0]; as winner) {
                        <div class="race-tile__winner">
                          <app-driver-avatar
                            [forename]="winner.driver?.forename ?? ''"
                            [surname]="winner.driver?.surname ?? ''"
                            [driverRef]="winner.driver?.driverRef ?? ''"
                            [color]="winner.teamColor"
                            size="xs"
                          />
                          <span class="race-tile__winner-text">
                            <small>Winner</small>
                            <strong>{{ winner.driver?.forename }} {{ winner.driver?.surname }}</strong>
                          </span>
                          <app-team-badge
                            [name]="winner.constructor?.name ?? ''"
                            [teamRef]="winner.constructor?.constructorRef ?? ''"
                            [color]="winner.teamColor"
                            [compact]="true"
                          />
                        </div>
                      }

                      <div class="race-tile__footer">
                        <span class="race-tile__podium">
                          @for (row of item.detail.podium; track row.resultId; let i = $index) {
                            <span class="race-tile__podium-step" [style.background]="row.teamColor" [title]="row.driver?.surname ?? ''">
                              {{ i + 1 }}
                            </span>
                          }
                        </span>
                        <span class="race-tile__cta">Classification →</span>
                      </div>
                    </div>
                  </article>
                </app-panel>
              </a>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .year-control {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem;
        border-radius: 999px;
      }

      .year-control__step {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: var(--text-2);
      }

      .year-control__step:hover:not(:disabled) {
        background: var(--surface-2);
        color: var(--text);
      }

      .year-control__step:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .year-control__select {
        padding: 0.3rem 0.75rem;
        background: transparent;
        border: 0;
      }

      .year-control__select select {
        font-weight: 600;
        font-size: 0.85rem;
      }

      .year-rail {
        display: flex;
        gap: 0.4rem;
        overflow-x: auto;
        padding-bottom: 0.9rem;
        margin-bottom: 1.25rem;
        scrollbar-width: thin;
      }

      .year-chip {
        flex: 0 0 auto;
        padding: 0.45rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text-2);
        font-size: 0.78rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .year-chip:hover {
        color: var(--text);
        border-color: var(--border-strong);
      }

      .year-chip.is-active {
        background: var(--accent);
        border-color: transparent;
        color: #fff;
      }

      .season-summary {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(90px, 0.55fr)) auto;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-radius: var(--r-lg);
        margin-bottom: 1rem;
      }

      .season-summary__block {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }

      .season-summary__block .display {
        font-size: 1.5rem;
      }

      .season-summary__block--champion {
        border-right: 1px solid var(--divider);
        padding-right: 1rem;
      }

      .champion-link {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        color: var(--text);
      }

      .champion-link span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .champion-link strong {
        font-size: 0.82rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .champion-link small {
        font-size: 0.66rem;
        color: var(--text-3);
      }

      .season-summary__actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding: 0.6rem;
        border-radius: 999px;
        margin-bottom: 0.75rem;
      }

      .toolbar__search {
        flex: 1 1 300px;
        background: transparent;
        border: 0;
        padding-left: 0.75rem;
      }

      .toolbar__search svg {
        width: 17px;
        height: 17px;
        color: var(--text-3);
        flex: 0 0 auto;
      }

      .toolbar__select {
        padding: 0.45rem 0.85rem;
        background: var(--surface-2);
      }

      .toolbar__select select {
        font-size: 0.8rem;
        font-weight: 600;
      }

      .results-line {
        margin: 0.4rem 0 1rem;
        font-size: 0.78rem;
      }

      .results-line strong {
        color: var(--text);
      }

      .race-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 1rem;
      }

      .race-card-link {
        display: block;
        height: 100%;
        color: var(--text);
      }

      .race-card-link app-panel {
        display: block;
        height: 100%;
      }

      .race-tile {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .race-tile__hero {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 92px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--divider);
        border-top: 2px solid var(--race-color, var(--border));
        overflow: hidden;
      }

      .race-tile__flag {
        font-size: 2.15rem;
      }

      .race-tile__round {
        position: absolute;
        left: 0.75rem;
        top: 0.65rem;
        font-size: 0.63rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-4);
      }

      .race-tile__date {
        position: absolute;
        right: 0.6rem;
        bottom: 0.55rem;
        padding: 0.12rem 0.42rem;
        border-radius: 999px;
        background: var(--surface);
        border: 1px solid var(--border);
        font-size: 0.6rem;
        font-weight: 600;
        color: var(--text-3);
      }

      .race-tile__body {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.9rem 1rem 1rem;
        flex: 1;
      }

      .race-tile__body h3 {
        font-size: 1rem;
        letter-spacing: -0.02em;
      }

      .race-tile__circuit {
        font-size: 0.7rem;
        color: var(--text-3);
      }

      .race-tile__winner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.45rem;
        padding: 0.45rem 0.55rem;
        border-radius: var(--r-sm);
        background: var(--surface-2);
        border: 1px solid var(--border);
        min-width: 0;
      }

      .race-tile__winner-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }

      .race-tile__winner-text small {
        font-size: 0.58rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-3);
      }

      .race-tile__winner-text strong {
        font-size: 0.76rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .race-tile__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-top: auto;
        padding-top: 0.75rem;
      }

      .race-tile__podium {
        display: flex;
        gap: 0.2rem;
      }

      .race-tile__podium-step {
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        border-radius: 5px;
        font-size: 0.58rem;
        font-weight: 700;
        color: #fff;
        opacity: 0.85;
      }

      .race-tile__cta {
        font-size: 0.68rem;
        font-weight: 600;
        color: var(--text-3);
        transition: color var(--dur-fast) var(--ease);
      }

      .race-card-link:hover .race-tile__cta {
        color: var(--accent);
      }

      @media (max-width: 1080px) {
        .season-summary {
          grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(70px, 0.5fr));
        }

        .season-summary__actions {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }
      }

      @media (max-width: 720px) {
        .season-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-radius: var(--r-md);
        }

        .season-summary__block--champion {
          grid-column: 1 / -1;
          border-right: 0;
          border-bottom: 1px solid var(--divider);
          padding-bottom: 0.75rem;
          padding-right: 0;
        }

        .toolbar {
          border-radius: var(--r-md);
        }

        .toolbar__search {
          flex-basis: 100%;
        }

        .toolbar__select {
          flex: 1;
        }

        .year-control {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class RacesComponent implements OnInit {
  private readonly csv = inject(CSVDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly openF1Start = OPENF1_START_YEAR;
  readonly years = signal<number[]>([]);
  readonly year = signal(ARCHIVE_END_YEAR);
  readonly archiveEnd = ARCHIVE_END_YEAR;
  readonly races = signal<SeasonRace[]>([]);
  readonly allCircuits = signal<CircuitCareer[]>([]);
  readonly champions = signal<ChampionRow[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly circuitFilter = signal<string | null>(null);
  private ready = false;

  readonly seasonChampion = computed(
    () => this.champions().find((row) => row.year === this.year()) ?? null,
  );

  readonly winnersCount = computed(
    () =>
      new Set(
        this.races()
          .map((item) => item.detail.results[0]?.driverId)
          .filter((id): id is number => id !== undefined),
      ).size,
  );

  readonly countryCount = computed(
    () => new Set(this.races().map((item) => item.detail.circuit?.country).filter(Boolean)).size,
  );

  readonly seasonCircuits = computed(() => {
    const ids = new Set(this.races().map((item) => item.race.circuitId));
    return this.allCircuits()
      .filter((circuit) => ids.has(circuit.circuitId))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const circuitRef = this.circuitFilter();

    let list = this.races();
    if (circuitRef) {
      const ids = new Set(
        this.allCircuits()
          .filter((circuit) => circuit.circuitRef === circuitRef)
          .map((circuit) => circuit.circuitId),
      );
      list = list.filter((item) => ids.has(item.race.circuitId));
    }
    if (term) {
      list = list.filter((item) =>
        `${item.race.name} ${item.detail.circuit?.name ?? ''} ${item.detail.circuit?.location ?? ''} ${item.detail.circuit?.country ?? ''}`
          .toLowerCase()
          .includes(term),
      );
    }
    return list;
  });

  readonly filteredCircuitName = computed(() => {
    const ref = this.circuitFilter();
    if (!ref) return '';
    return this.allCircuits().find((circuit) => circuit.circuitRef === ref)?.name ?? '';
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (!this.ready) return;

      this.circuitFilter.set(params.get('circuit'));
      const requested = Number(params.get('year'));
      if (Number.isFinite(requested) && requested >= 2000 && requested !== this.year()) {
        this.year.set(requested);
        this.load();
      } else if (params.get('circuit') !== null || params.get('year') !== null) {
        this.load();
      }
    });
  }

  ngOnInit(): void {
    forkJoin({
      years: this.csv.getSeasons(),
      circuits: this.csv.getCircuits(),
      champions: this.csv.getChampions(),
    }).subscribe(({ years, circuits, champions }) => {
      this.years.set(years);
      this.allCircuits.set(circuits);
      this.champions.set(champions);

      const requested = Number(this.route.snapshot.queryParamMap.get('year'));
      const year = Number.isFinite(requested) && requested >= 2000 ? requested : (years[0] ?? ARCHIVE_END_YEAR);
      this.year.set(year);
      this.circuitFilter.set(this.route.snapshot.queryParamMap.get('circuit'));
      this.ready = true;
      this.load();
    });
  }

  selectYear(year: number): void {
    if (year === this.year()) return;
    this.year.set(year);
    this.circuitFilter.set(null);
    this.syncUrl(year, null);
    this.load();
  }

  onYearChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value)) this.selectYear(value);
  }

  canStep(direction: 1 | -1): boolean {
    const index = this.years().indexOf(this.year());
    const next = index + direction;
    return next >= 0 && next < this.years().length;
  }

  step(direction: 1 | -1): void {
    const index = this.years().indexOf(this.year());
    const next = this.years()[index + direction];
    if (next) this.selectYear(next);
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onCircuitChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const ref = value === 'all' ? null : value;
    this.circuitFilter.set(ref);
    this.syncUrl(this.year(), ref);
  }

  clearCircuit(): void {
    this.circuitFilter.set(null);
    this.syncUrl(this.year(), null);
  }

  flag(country: string): string {
    return countryFlag(country);
  }

  code(country: string): string {
    return countryCode(country);
  }

  private syncUrl(year: number, circuit: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year, circuit: circuit ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private load(): void {
    this.loading.set(true);
    this.csv
      .getRaces(this.year())
      .pipe(
        switchMap((races) =>
          races.length
            ? forkJoin(races.map((race) => this.csv.getRace(race.raceId)))
            : of([]),
        ),
      )
      .subscribe((details) => {
        const mapped: SeasonRace[] = details
          .filter((detail): detail is RaceWithResults => !!detail)
          .map((detail) => ({ race: detail.race, detail }))
          .sort((a, b) => a.race.round - b.race.round);

        this.races.set(mapped);
        this.loading.set(false);
      });
  }
}
