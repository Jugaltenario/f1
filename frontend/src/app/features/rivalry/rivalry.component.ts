import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DriverCareer, RivalryData, RivalSeason } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { formatNumber } from '../../core/utils/format';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SparkChartComponent, ChartSeries } from '../../shared/components/spark-chart/spark-chart.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

interface Totals {
  wins: number;
  podiums: number;
  poles: number;
  titles: number;
  seasons: number;
  points: number;
  bestFinish: number | null;
}

interface SeasonRow {
  year: number;
  d1: RivalSeason | null;
  d2: RivalSeason | null;
  leader: 'd1' | 'd2' | 'tie';
}

interface RivalPair {
  driver1: RivalryData;
  driver2: RivalryData;
}

@Component({
  selector: 'app-rivalry',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    PanelComponent,
    DriverAvatarComponent,
    TeamBadgeComponent,
    SparkChartComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page rivalry-page">
      <app-page-header
        eyebrow="Head to head"
        title="Rivalry engine"
        subtitle="Put any two drivers from the 2000-onward archive side by side — career totals, season-by-season points and who came out ahead."
      >
        <a class="btn btn--sm" routerLink="/drivers">Browse drivers →</a>
      </app-page-header>

      @if (loadingDrivers()) {
        <app-skeleton-loader [count]="1" [height]="170" />
      } @else {
        <!-- ------------------------------------------------------------ selector -->
        <section class="selector panel">
          <div class="selector__side" [style.--side-color]="driver1()?.teamColor ?? '#8b8f98'">
            @if (driver1(); as d) {
              <app-driver-avatar
                [forename]="d.forename"
                [surname]="d.surname"
                [driverRef]="d.driverRef"
                [color]="d.teamColor"
                size="lg"
              />
              <div class="selector__copy">
                <h2>{{ d.forename }} {{ d.surname }}</h2>
                <app-team-badge [name]="d.teamName" [teamRef]="d.teamRef" [color]="d.teamColor" />
              </div>
            } @else {
              <span class="selector__placeholder" aria-hidden="true">?</span>
              <div class="selector__copy">
                <h2>Driver one</h2>
                <span class="dim">Pick from the archive</span>
              </div>
            }

            <div class="field selector__field">
              <select [value]="driver1Id() ?? ''" (change)="onDriver1($event)" aria-label="First driver">
                <option value="">Select a driver</option>
                @for (driver of drivers(); track driver.driverId) {
                  <option [value]="driver.driverId" [disabled]="driver.driverId === driver2Id()">
                    {{ driver.surname }}, {{ driver.forename }} · {{ driver.teamName }}
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="selector__vs">
            <span class="selector__vs-badge">VS</span>
            <button type="button" class="btn btn--ghost btn--sm" (click)="swap()" [disabled]="!driver1Id() && !driver2Id()">
              Swap ↺
            </button>
          </div>

          <div class="selector__side selector__side--right" [style.--side-color]="driver2()?.teamColor ?? '#8b8f98'">
            @if (driver2(); as d) {
              <app-driver-avatar
                [forename]="d.forename"
                [surname]="d.surname"
                [driverRef]="d.driverRef"
                [color]="d.teamColor"
                size="lg"
              />
              <div class="selector__copy">
                <h2>{{ d.forename }} {{ d.surname }}</h2>
                <app-team-badge [name]="d.teamName" [teamRef]="d.teamRef" [color]="d.teamColor" />
              </div>
            } @else {
              <span class="selector__placeholder" aria-hidden="true">?</span>
              <div class="selector__copy">
                <h2>Driver two</h2>
                <span class="dim">Pick from the archive</span>
              </div>
            }

            <div class="field selector__field">
              <select [value]="driver2Id() ?? ''" (change)="onDriver2($event)" aria-label="Second driver">
                <option value="">Select a driver</option>
                @for (driver of drivers(); track driver.driverId) {
                  <option [value]="driver.driverId" [disabled]="driver.driverId === driver1Id()">
                    {{ driver.surname }}, {{ driver.forename }} · {{ driver.teamName }}
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="selector__actions">
            <button type="button" class="btn btn--primary" [disabled]="!canCompare()" (click)="compare()">
              Compare careers
            </button>
            <button type="button" class="btn btn--ghost btn--sm" (click)="randomPair()">Random pair</button>
          </div>
        </section>

        @if (loadingPair()) {
          <div class="pair-loading">
            <app-skeleton-loader [count]="2" [height]="120" />
            <app-skeleton-loader [count]="1" [height]="240" />
          </div>
        } @else if (pair(); as p) {
          <!-- --------------------------------------------------------------- hero -->
          <section class="versus">
            <app-panel class="versus__card" variant="accent" [accent]="p.driver1.teamColor">
              <div class="pilot">
                <app-driver-avatar
                  [forename]="p.driver1.driver?.forename ?? ''"
                  [surname]="p.driver1.driver?.surname ?? ''"
                  [driverRef]="p.driver1.driver?.driverRef ?? ''"
                  [color]="p.driver1.teamColor"
                  size="xl"
                />
                <h2>{{ p.driver1.driverName }}</h2>
                <span class="pilot__sub dim">
                  {{ p.driver1.seasons[0]?.year }}–{{ p.driver1.seasons[p.driver1.seasons.length - 1]?.year }}
                </span>

                <div class="pilot__stats">
                  <span><strong>{{ totals1().titles }}</strong><small>titles</small></span>
                  <span><strong>{{ totals1().wins }}</strong><small>wins</small></span>
                  <span><strong>{{ totals1().podiums }}</strong><small>podiums</small></span>
                  <span><strong>{{ totals1().poles }}</strong><small>poles</small></span>
                  <span><strong>{{ totals1().seasons }}</strong><small>seasons</small></span>
                  <span><strong>{{ formatPoints(totals1().points) }}</strong><small>points</small></span>
                </div>
              </div>
            </app-panel>

            <div class="versus__middle">
              <span class="versus__score tabular">{{ headToHead().d1 }}<small>–</small>{{ headToHead().d2 }}</span>
              <span class="versus__score-label">seasons ahead</span>
              @if (headToHead().shared) {
                <span class="versus__shared dim">{{ headToHead().shared }} shared seasons</span>
              }
            </div>

            <app-panel class="versus__card" variant="accent" [accent]="p.driver2.teamColor">
              <div class="pilot">
                <app-driver-avatar
                  [forename]="p.driver2.driver?.forename ?? ''"
                  [surname]="p.driver2.driver?.surname ?? ''"
                  [driverRef]="p.driver2.driver?.driverRef ?? ''"
                  [color]="p.driver2.teamColor"
                  size="xl"
                />
                <h2>{{ p.driver2.driverName }}</h2>
                <span class="pilot__sub dim">
                  {{ p.driver2.seasons[0]?.year }}–{{ p.driver2.seasons[p.driver2.seasons.length - 1]?.year }}
                </span>

                <div class="pilot__stats">
                  <span><strong>{{ totals2().titles }}</strong><small>titles</small></span>
                  <span><strong>{{ totals2().wins }}</strong><small>wins</small></span>
                  <span><strong>{{ totals2().podiums }}</strong><small>podiums</small></span>
                  <span><strong>{{ totals2().poles }}</strong><small>poles</small></span>
                  <span><strong>{{ totals2().seasons }}</strong><small>seasons</small></span>
                  <span><strong>{{ formatPoints(totals2().points) }}</strong><small>points</small></span>
                </div>
              </div>
            </app-panel>
          </section>

          <!-- -------------------------------------------------------------- chart -->
          <app-panel class="chart-card">
            <div class="card-head">
              <div>
                <span class="eyebrow">Points trajectory</span>
                <h2>Season by season</h2>
              </div>
              <span class="pill">{{ years().length }} seasons</span>
            </div>
            <div class="chart-card__body">
              <app-spark-chart
                [series]="chartSeries()"
                [axisLabels]="yearLabels()"
                ariaLabel="Championship points per season"
              />
            </div>
          </app-panel>

          <!-- -------------------------------------------------------------- table -->
          <app-panel class="table-card">
            <div class="card-head">
              <div>
                <span class="eyebrow">Head to head</span>
                <h2>Championship positions</h2>
              </div>
              <span class="pill">{{ headToHead().d1 }} – {{ headToHead().d2 }}</span>
            </div>

            <div class="table-scroll">
              <table class="compare-table">
                <thead>
                  <tr>
                    <th scope="col">Season</th>
                    <th scope="col">{{ p.driver1.driver?.surname }}</th>
                    <th scope="col">Pts</th>
                    <th scope="col">{{ p.driver2.driver?.surname }}</th>
                    <th scope="col">Pts</th>
                    <th scope="col">Edge</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of seasonRows(); track row.year) {
                    <tr>
                      <td>
                        <a class="year-link tabular" routerLink="/standings" [queryParams]="{ year: row.year }">{{ row.year }}</a>
                      </td>
                      <td [class.is-ahead]="row.leader === 'd1'">
                        {{ row.d1 ? 'P' + row.d1.position : '—' }}
                        <span class="row-wins">· {{ row.d1?.wins ?? 0 }}W</span>
                      </td>
                      <td class="tabular">{{ row.d1 ? formatPoints(row.d1.points) : '—' }}</td>
                      <td [class.is-ahead]="row.leader === 'd2'">
                        {{ row.d2 ? 'P' + row.d2.position : '—' }}
                        <span class="row-wins">· {{ row.d2?.wins ?? 0 }}W</span>
                      </td>
                      <td class="tabular">{{ row.d2 ? formatPoints(row.d2.points) : '—' }}</td>
                      <td>
                        @if (row.leader === 'tie') {
                          <span class="edge edge--tie">Tie</span>
                        } @else if (row.d1 && row.d2) {
                          <span
                            class="edge"
                            [style.color]="row.leader === 'd1' ? p.driver1.teamColor : p.driver2.teamColor"
                          >
                            {{ row.leader === 'd1' ? p.driver1.driver?.surname : p.driver2.driver?.surname }}
                          </span>
                        } @else {
                          <span class="dim">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-panel>
        } @else {
          <app-empty-state
            icon="⚔️"
            title="Choose two drivers to start"
            [message]="'Pick from ' + drivers().length + ' drivers in the 2000-onward archive. Their seasons, points, wins and championships line up side by side.'"
          />
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ------------------------------------------------------------- selector */
      .selector {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        grid-template-areas:
          'left vs right'
          'actions actions actions';
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: var(--r-xl);
        margin-bottom: 1.5rem;
      }

      .selector__side {
        position: relative;
        grid-area: left;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.85rem;
        border-left: 2px solid var(--side-color, var(--border));
        border-radius: var(--r-md);
        background: var(--surface-2);
        border-top: 1px solid var(--border);
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
      }

      .selector__side--right {
        grid-area: right;
      }

      .selector__copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
        flex: 1;
      }

      .selector__copy h2 {
        font-size: 1.05rem;
        letter-spacing: -0.02em;
      }

      .selector__placeholder {
        display: grid;
        place-items: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: 1px dashed var(--border-strong);
        background: var(--surface-2);
        font-family: var(--font-display);
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-3);
      }

      .selector__field {
        flex: 1 0 100%;
        padding: 0.4rem 0.8rem;
        background: var(--bg-2);
      }

      .selector__field select {
        font-size: 0.78rem;
      }

      .selector__vs {
        grid-area: vs;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .selector__vs-badge {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: var(--accent);
        color: #fff;
        font-family: var(--font-display);
        font-size: 0.8rem;
        font-weight: 700;
        box-shadow: 0 10px 24px -10px var(--accent);
      }

      .selector__actions {
        grid-area: actions;
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding-top: 0.25rem;
      }

      /* --------------------------------------------------------------- versus */
      .versus {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: stretch;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }

      .versus__card {
        height: 100%;
      }

      .pilot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        padding: 1.5rem 1.25rem;
        text-align: center;
      }

      .pilot h2 {
        font-size: clamp(1.15rem, 2.4vw, 1.5rem);
        letter-spacing: -0.03em;
        margin-top: 0.35rem;
      }

      .pilot__sub {
        font-size: 0.7rem;
      }

      .pilot__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.6rem;
        width: 100%;
        margin-top: 0.9rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--divider);
      }

      .pilot__stats span {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .pilot__stats strong {
        font-family: var(--font-display);
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .pilot__stats small {
        font-size: 0.58rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-3);
      }

      .versus__middle {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.15rem;
        padding: 0.5rem;
        min-width: 120px;
      }

      .versus__score {
        font-family: var(--font-display);
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        font-weight: 700;
        letter-spacing: -0.03em;
      }

      .versus__score small {
        margin: 0 0.2rem;
        color: var(--text-3);
        font-weight: 500;
      }

      .versus__score-label {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
        text-align: center;
      }

      .versus__shared {
        font-size: 0.64rem;
        text-align: center;
      }

      /* ---------------------------------------------------------------- chart */
      .chart-card {
        margin-bottom: 1.25rem;
      }

      .card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.1rem 1.25rem 0.75rem;
      }

      .card-head h2 {
        font-size: 1.1rem;
        margin-top: 0.15rem;
      }

      .chart-card__body {
        padding: 0 1.25rem 1.25rem;
      }

      /* ---------------------------------------------------------------- table */
      .table-scroll {
        overflow-x: auto;
      }

      .compare-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        min-width: 640px;
      }

      .compare-table th {
        padding: 0.7rem 1rem;
        text-align: left;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: var(--bg-2);
        white-space: nowrap;
      }

      .compare-table td {
        padding: 0.55rem 1rem;
        border-bottom: 1px solid var(--divider);
      }

      .compare-table tbody tr:hover {
        background: var(--surface-2);
      }

      .compare-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .year-link {
        font-weight: 700;
        color: var(--text-2);
      }

      .year-link:hover {
        color: var(--accent);
      }

      .row-wins {
        font-size: 0.62rem;
        color: var(--text-3);
      }

      .is-ahead {
        font-weight: 700;
        color: var(--text);
      }

      .edge {
        font-size: 0.7rem;
        font-weight: 700;
      }

      .edge--tie {
        color: var(--text-3);
      }

      .pair-loading {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      @media (max-width: 900px) {
        .selector {
          grid-template-columns: 1fr;
          grid-template-areas:
            'left'
            'vs'
            'right'
            'actions';
        }

        .versus {
          grid-template-columns: 1fr;
        }

        .versus__middle {
          padding: 0.25rem;
        }
      }
    `,
  ],
})
export class RivalryComponent implements OnInit {
  private readonly csv = inject(CSVDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loadingDrivers = signal(true);
  readonly loadingPair = signal(false);
  readonly drivers = signal<DriverCareer[]>([]);
  readonly driver1Id = signal<number | null>(null);
  readonly driver2Id = signal<number | null>(null);
  readonly pair = signal<RivalPair | null>(null);

  readonly driver1 = computed(() => this.drivers().find((driver) => driver.driverId === this.driver1Id()) ?? null);
  readonly driver2 = computed(() => this.drivers().find((driver) => driver.driverId === this.driver2Id()) ?? null);

  readonly canCompare = computed(
    () => !!this.driver1Id() && !!this.driver2Id() && this.driver1Id() !== this.driver2Id(),
  );

  readonly totals1 = computed(() => this.computeTotals(this.pair()?.driver1 ?? null));
  readonly totals2 = computed(() => this.computeTotals(this.pair()?.driver2 ?? null));

  readonly years = computed(() => {
    const pair = this.pair();
    if (!pair) return [];
    const values = new Set<number>();
    for (const season of pair.driver1.seasons) values.add(season.year);
    for (const season of pair.driver2.seasons) values.add(season.year);
    return [...values].sort((a, b) => a - b);
  });

  readonly yearLabels = computed(() => this.years().map((year) => `${year}`));

  readonly chartSeries = computed<ChartSeries[]>(() => {
    const pair = this.pair();
    if (!pair) return [];
    const years = this.years();
    const value = (data: RivalryData): (number | null)[] =>
      years.map((year) => data.seasons.find((season) => season.year === year)?.points ?? null);

    return [
      { label: pair.driver1.driver?.surname ?? 'Driver 1', color: pair.driver1.teamColor, values: value(pair.driver1) },
      { label: pair.driver2.driver?.surname ?? 'Driver 2', color: pair.driver2.teamColor, values: value(pair.driver2) },
    ];
  });

  readonly seasonRows = computed<SeasonRow[]>(() => {
    const pair = this.pair();
    if (!pair) return [];
    return this.years()
      .map((year) => {
        const d1 = pair.driver1.seasons.find((season) => season.year === year) ?? null;
        const d2 = pair.driver2.seasons.find((season) => season.year === year) ?? null;
        let leader: SeasonRow['leader'] = 'tie';
        if (d1 && d2) {
          if (d1.position < d2.position) leader = 'd1';
          else if (d2.position < d1.position) leader = 'd2';
        } else if (d1) {
          leader = 'd1';
        } else if (d2) {
          leader = 'd2';
        }
        return { year, d1, d2, leader } satisfies SeasonRow;
      })
      .reverse();
  });

  readonly headToHead = computed(() => {
    let d1 = 0;
    let d2 = 0;
    let shared = 0;
    for (const row of this.seasonRows()) {
      if (!row.d1 || !row.d2) continue;
      shared += 1;
      if (row.d1.position < row.d2.position) d1 += 1;
      else if (row.d2.position < row.d1.position) d2 += 1;
    }
    return { d1, d2, shared };
  });

  ngOnInit(): void {
    this.csv.getDrivers().subscribe((drivers) => {
      this.drivers.set(drivers.slice().sort((a, b) => a.surname.localeCompare(b.surname)));
      this.loadingDrivers.set(false);

      const params = this.route.snapshot.queryParamMap;
      const d1 = Number(params.get('d1'));
      const d2 = Number(params.get('d2'));
      const hasD1 = drivers.some((driver) => driver.driverId === d1);
      const hasD2 = drivers.some((driver) => driver.driverId === d2);

      if (hasD1) this.driver1Id.set(d1);
      if (hasD2) this.driver2Id.set(d2);
      if (hasD1 && hasD2 && d1 !== d2) this.compare();
    });
  }

  onDriver1(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.driver1Id.set(Number.isFinite(value) && value ? value : null);
    this.pair.set(null);
  }

  onDriver2(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.driver2Id.set(Number.isFinite(value) && value ? value : null);
    this.pair.set(null);
  }

  swap(): void {
    const first = this.driver1Id();
    this.driver1Id.set(this.driver2Id());
    this.driver2Id.set(first);
    if (this.canCompare()) this.compare();
  }

  randomPair(): void {
    const drivers = this.drivers();
    if (drivers.length < 2) return;
    const first = drivers[Math.floor(Math.random() * drivers.length)];
    let second = drivers[Math.floor(Math.random() * drivers.length)];
    while (second.driverId === first.driverId) {
      second = drivers[Math.floor(Math.random() * drivers.length)];
    }
    this.driver1Id.set(first.driverId);
    this.driver2Id.set(second.driverId);
    this.compare();
  }

  compare(): void {
    const d1 = this.driver1Id();
    const d2 = this.driver2Id();
    if (!d1 || !d2 || d1 === d2) return;

    this.loadingPair.set(true);
    this.csv.getRivalry(d1, d2).subscribe((pair) => {
      this.pair.set(pair);
      this.loadingPair.set(false);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { d1, d2 },
        replaceUrl: true,
      });
    });
  }

  formatPoints(points: number): string {
    return formatNumber(Math.round(points * 10) / 10);
  }

  private computeTotals(data: RivalryData | null): Totals {
    if (!data) {
      return { wins: 0, podiums: 0, poles: 0, titles: 0, seasons: 0, points: 0, bestFinish: null };
    }

    const totals = data.seasons.reduce(
      (acc, season) => {
        acc.wins += season.wins;
        acc.podiums += season.podiums;
        acc.poles += season.poles;
        acc.points += season.points;
        if (season.position === 1) acc.titles += 1;
        acc.bestFinish = acc.bestFinish === null ? season.position : Math.min(acc.bestFinish, season.position);
        return acc;
      },
      { wins: 0, podiums: 0, poles: 0, titles: 0, points: 0, bestFinish: null as number | null },
    );

    return { ...totals, seasons: data.seasons.length };
  }
}
