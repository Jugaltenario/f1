import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  ChampionRow,
  Constructor,
  SeasonConstructorStanding,
  SeasonSummary,
  StandingsRow,
} from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { ARCHIVE_END_YEAR } from '../../core/config/data.config';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

interface TeamStanding extends SeasonConstructorStanding {
  constructor?: Constructor;
  color: string;
}

@Component({
  selector: 'app-standings',
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
    <div class="page standings-page">
      <app-page-header
        eyebrow="Season archive · 2000 → {{ archiveEnd }}"
        title="Standings"
        subtitle="Every drivers' and constructors' championship in the modern era. Pick a season to replay the table."
      >
        <div class="year-control panel">
          <button
            type="button"
            class="year-control__step"
            aria-label="Previous season"
            [disabled]="!canStep(-1)"
            (click)="step(-1)"
          >
            ←
          </button>
          <div class="field year-control__select">
            <select [value]="year()" (change)="onYearChange($event)" aria-label="Season">
              @for (y of years(); track y) {
                <option [value]="y">{{ y }} season</option>
              }
            </select>
          </div>
          <button
            type="button"
            class="year-control__step"
            aria-label="Next season"
            [disabled]="!canStep(1)"
            (click)="step(1)"
          >
            →
          </button>
        </div>

        <button type="button" class="btn btn--sm" (click)="exportCsv()">Export CSV</button>
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
        <div class="loading-grid">
          <app-skeleton-loader [count]="1" [height]="180" />
          <app-skeleton-loader [count]="8" [height]="58" />
        </div>
      } @else if (!drivers().length) {
        <app-empty-state
          icon="🗓️"
          [title]="year() + ' is not in the archive yet'"
          [message]="'The bundled archive covers 2000 to ' + archiveEnd + '. Newer sessions are available through the OpenF1 live replay.'"
          actionLabel="Open live timing"
          actionLink="/live"
        />
      } @else {
        <!-- -------------------------------------------------------- season banner -->
        <section class="season-banner">
          @if (feature(); as f) {
            <app-panel class="champion-card" variant="accent" [accent]="f.teamColor">
              <div class="champion-card__head">
                <span class="eyebrow">
                  {{ seasonComplete() ? "Drivers' world champion" : 'Championship leader · season in progress' }}
                </span>
                <span class="champion-card__year display">{{ year() }}</span>
              </div>

              @if (f.driver; as driver) {
                <div class="champion-card__body">
                  <app-driver-avatar
                    [forename]="driver.forename"
                    [surname]="driver.surname"
                    [driverRef]="driver.driverRef"
                    [color]="f.teamColor"
                    size="xl"
                  />
                  <div class="champion-card__copy">
                    <h2>{{ driver.forename }}<br />{{ driver.surname }}</h2>
                    <app-team-badge
                      [name]="f.constructor?.name ?? ''"
                      [teamRef]="f.constructor?.constructorRef ?? ''"
                      [color]="f.teamColor"
                    />
                    <div class="champion-card__stats">
                      <span><strong>{{ f.points }}</strong> pts</span>
                      <span><strong>{{ f.wins }}</strong> wins</span>
                      @if (seasonComplete()) {
                        <span><strong>{{ titles() }}</strong> title{{ titles() === 1 ? '' : 's' }}</span>
                        <span><strong>{{ margin() }}</strong> pts margin</span>
                      } @else {
                        <span><strong>{{ roundsLeft() }}</strong> rounds left</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </app-panel>
          }

          <div class="season-side">
            <app-panel class="mini-card">
              <span class="eyebrow">
                {{ seasonComplete() ? "Constructors' champion" : "Constructors' leader" }}
              </span>
              @if (teamChampion(); as team) {
                <div class="mini-card__team">
                  <span class="mini-card__swatch" [style.background]="team.color"></span>
                  <strong>{{ team.constructor?.name }}</strong>
                </div>
                <div class="mini-card__stats">
                  <span><strong>{{ team.points }}</strong> points</span>
                  <span><strong>{{ team.wins }}</strong> wins</span>
                </div>
              }
            </app-panel>

            <app-panel class="mini-card">
              <span class="eyebrow">Runner-up</span>
              @if (runnerUp()?.driver; as driver) {
                <div class="mini-card__team">
                  <app-driver-avatar
                    [forename]="driver.forename"
                    [surname]="driver.surname"
                    [driverRef]="driver.driverRef"
                    [color]="runnerUp()?.teamColor ?? '#888'"
                    size="sm"
                  />
                  <strong>{{ driver.forename }} {{ driver.surname }}</strong>
                </div>
                <div class="mini-card__stats">
                  <span><strong>{{ runnerUp()?.points }}</strong> points</span>
                  <span><strong>{{ gapToLeader(runnerUp()) }}</strong> behind</span>
                </div>
              }
            </app-panel>
          </div>
        </section>

        <!-- --------------------------------------------------------------- tables -->
        <section class="tables">
          <app-panel class="table-panel">
            <div class="panel-head">
              <div>
                <span class="eyebrow">Drivers' championship</span>
                <h2>{{ year() }} classification</h2>
              </div>
              <span class="pill">{{ drivers().length }} drivers</span>
            </div>

            <div class="table" role="table" aria-label="Drivers standings">
              <div class="table__head" role="row">
                <span role="columnheader">Pos</span>
                <span role="columnheader">Driver</span>
                <span role="columnheader" class="hide-sm">Team</span>
                <span role="columnheader" class="hide-xs">Wins</span>
                <span role="columnheader" class="points-head">Points</span>
              </div>

              @for (row of drivers(); track row.driver?.driverId) {
                <a
                  class="table__row driver-row"
                  role="row"
                  [routerLink]="['/drivers']"
                  [queryParams]="{ driver: row.driver?.driverId }"
                  [style.--team-color]="row.teamColor"
                >
                  <span class="pos" [class.pos--podium]="row.position <= 3">{{ row.position }}</span>
                  <span class="driver-cell">
                    <app-driver-avatar
                      [forename]="row.driver?.forename ?? ''"
                      [surname]="row.driver?.surname ?? ''"
                      [driverRef]="row.driver?.driverRef ?? ''"
                      [color]="row.teamColor"
                      size="sm"
                    />
                    <span class="driver-cell__text">
                      <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                      <small>{{ row.driver?.nationality }} · {{ row.driver?.code || '—' }}</small>
                    </span>
                  </span>
                  <span class="hide-sm team-cell">
                    <app-team-badge
                      [name]="row.constructor?.name ?? '—'"
                      [teamRef]="row.constructor?.constructorRef ?? ''"
                      [color]="row.teamColor"
                    />
                  </span>
                  <span class="hide-xs tabular wins-cell">{{ row.wins }}</span>
                  <span class="points-cell">
                    <strong class="tabular">{{ row.points }}</strong>
                    <span class="points-bar">
                      <span
                        class="points-bar__fill"
                        [style.width.%]="pointsShare(row, drivers())"
                        [style.background]="row.teamColor"
                      ></span>
                    </span>
                  </span>
                </a>
              }
            </div>
          </app-panel>

          <app-panel class="table-panel">
            <div class="panel-head">
              <div>
                <span class="eyebrow">Constructors' championship</span>
                <h2>{{ year() }} teams</h2>
              </div>
              <span class="pill">{{ teams().length }} teams</span>
            </div>

            <div class="table" role="table" aria-label="Constructors standings">
              <div class="table__head" role="row">
                <span role="columnheader">Pos</span>
                <span role="columnheader">Team</span>
                <span role="columnheader" class="hide-xs">Wins</span>
                <span role="columnheader" class="points-head">Points</span>
              </div>

              @for (row of teams(); track row.constructorId) {
                <div class="table__row team-row" role="row" [style.--team-color]="row.color">
                  <span class="pos" [class.pos--podium]="row.position <= 3">{{ row.position }}</span>
                  <span class="team-cell">
                    <span class="team-cell__swatch" [style.background]="row.color"></span>
                    <span class="driver-cell__text">
                      <strong>{{ row.constructor?.name ?? '—' }}</strong>
                      <small>{{ row.constructor?.nationality }}</small>
                    </span>
                  </span>
                  <span class="hide-xs tabular wins-cell">{{ row.wins }}</span>
                  <span class="points-cell">
                    <strong class="tabular">{{ row.points }}</strong>
                    <span class="points-bar">
                      <span
                        class="points-bar__fill"
                        [style.width.%]="teamPointsShare(row)"
                        [style.background]="row.color"
                      ></span>
                    </span>
                  </span>
                </div>
              }
            </div>
          </app-panel>
        </section>
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
        transition: background var(--dur-fast) var(--ease);
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
        margin-bottom: 1.5rem;
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
        transition:
          background var(--dur-fast) var(--ease),
          color var(--dur-fast) var(--ease),
          border-color var(--dur-fast) var(--ease);
      }

      .year-chip:hover {
        color: var(--text);
        border-color: var(--border-strong);
      }

      .year-chip.is-active {
        background: var(--accent);
        border-color: transparent;
        color: #fff;
        box-shadow: 0 8px 20px -10px var(--accent);
      }

      .loading-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      .season-banner {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.85fr);
        gap: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .champion-card__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 1.5rem 1.5rem 0;
      }

      .champion-card__year {
        font-size: clamp(2rem, 4vw, 3rem);
        color: color-mix(in srgb, var(--accent) 65%, var(--text));
      }

      .champion-card__body {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1rem 1.5rem 1.5rem;
      }

      .champion-card__copy {
        min-width: 0;
      }

      .champion-card__copy h2 {
        font-size: clamp(1.6rem, 3.4vw, 2.4rem);
        letter-spacing: -0.04em;
        line-height: 0.98;
        margin-bottom: 0.45rem;
      }

      .champion-card__stats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1.35rem;
        margin-top: 0.9rem;
        padding-top: 0.85rem;
        border-top: 1px solid var(--divider);
        font-size: 0.73rem;
        color: var(--text-3);
      }

      .champion-card__stats strong {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text);
      }

      .season-side {
        display: grid;
        gap: 1.25rem;
      }

      .mini-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1.15rem 1.3rem;
      }

      .mini-card__team {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-width: 0;
      }

      .mini-card__team strong {
        font-size: 0.98rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mini-card__swatch {
        width: 12px;
        height: 26px;
        border-radius: 4px;
        flex: 0 0 auto;
      }

      .mini-card__stats {
        display: flex;
        gap: 1.25rem;
        font-size: 0.72rem;
        color: var(--text-3);
      }

      .mini-card__stats strong {
        color: var(--text);
        font-size: 0.92rem;
        font-weight: 700;
        margin-right: 0.25rem;
      }

      .tables {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
        gap: 1.25rem;
        align-items: start;
      }

      .table-panel {
        padding: 1.4rem;
      }

      .panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .panel-head h2 {
        font-size: 1.25rem;
        margin-top: 0.15rem;
      }

      .table {
        display: flex;
        flex-direction: column;
      }

      .table__head,
      .table__row {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) minmax(0, 0.75fr) 52px 104px;
        align-items: center;
        gap: 0.5rem;
      }

      .team-row .table__head,
      .team-row,
      .table__head:has(+ .team-row) {
        grid-template-columns: 36px minmax(0, 1fr) 52px 104px;
      }

      .table__head {
        padding: 0 0.5rem 0.55rem;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--text-3);
        border-bottom: 1px solid var(--divider);
      }

      .table__row {
        padding: 0.6rem 0.5rem;
        border-bottom: 1px solid var(--divider);
        border-radius: var(--r-sm);
        color: var(--text);
        transition: background var(--dur-fast) var(--ease);
      }

      .table__row:last-child {
        border-bottom: 0;
      }

      .table__row:hover {
        background: var(--surface-2);
      }

      .table__head .points-head {
        text-align: right;
      }

      .pos {
        font-family: var(--font-display);
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-3);
        font-variant-numeric: tabular-nums;
      }

      .pos--podium {
        color: var(--accent);
      }

      .driver-cell,
      .team-cell {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-width: 0;
      }

      .driver-cell__text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .driver-cell__text strong {
        font-size: 0.84rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .driver-cell__text small {
        font-size: 0.67rem;
        color: var(--text-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .team-cell__swatch {
        width: 8px;
        height: 28px;
        border-radius: 3px;
        flex: 0 0 auto;
      }

      .wins-cell {
        text-align: center;
        font-size: 0.82rem;
        color: var(--text-2);
      }

      .points-cell {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
      }

      .points-cell strong {
        font-size: 0.92rem;
        font-weight: 700;
      }

      .points-bar {
        display: block;
        width: 100%;
        height: 3px;
        border-radius: 999px;
        background: var(--surface-3);
        overflow: hidden;
      }

      .points-bar__fill {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      @media (max-width: 1180px) {
        .tables,
        .season-banner {
          grid-template-columns: 1fr;
        }

        .season-side {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 900px) {
        .hide-sm {
          display: none;
        }

        .table__head,
        .table__row {
          grid-template-columns: 32px minmax(0, 1fr) 52px 90px;
        }

        .team-row .table__head,
        .team-row,
        .table__head:has(+ .team-row) {
          grid-template-columns: 32px minmax(0, 1fr) 52px 90px;
        }
      }

      @media (max-width: 680px) {
        .hide-xs {
          display: none;
        }

        .table__head,
        .table__row,
        .team-row .table__head,
        .team-row,
        .table__head:has(+ .team-row) {
          grid-template-columns: 28px minmax(0, 1fr) 84px;
        }

        .season-side {
          grid-template-columns: 1fr;
        }

        .champion-card__body {
          flex-direction: column;
          align-items: flex-start;
        }

        .year-control {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class StandingsComponent implements OnInit {
  private readonly csv = inject(CSVDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private initialised = false;

  readonly years = signal<number[]>([]);
  readonly year = signal(ARCHIVE_END_YEAR);
  readonly drivers = signal<StandingsRow[]>([]);
  readonly teams = signal<TeamStanding[]>([]);
  readonly champions = signal<ChampionRow[]>([]);
  readonly summary = signal<SeasonSummary | null>(null);
  readonly loading = signal(true);
  readonly archiveEnd = ARCHIVE_END_YEAR;

  readonly champion = computed(() => this.champions().find((row) => row.year === this.year()) ?? null);
  readonly seasonComplete = computed(() => this.champion() !== null);
  /** Champion if the season is decided, otherwise the current leader. Never a fabricated title. */
  readonly feature = computed(() => this.champion() ?? this.drivers()[0] ?? null);
  readonly roundsLeft = computed(() => {
    const summary = this.summary();
    return summary ? Math.max(0, summary.roundsTotal - summary.roundsCompleted) : 0;
  });
  readonly runnerUp = computed<StandingsRow | null>(() => this.drivers()[1] ?? null);
  readonly teamChampion = computed(() => this.teams()[0] ?? null);
  readonly margin = computed(() => {
    const champion = this.feature();
    const runnerUp = this.runnerUp();
    if (!champion || !runnerUp) return 0;
    return Math.max(0, Math.round((champion.points - runnerUp.points) * 10) / 10);
  });
  readonly titles = computed(() => {
    const driverId = this.champion()?.driver?.driverId;
    if (!driverId) return 0;
    return this.champions().filter((row) => row.driver?.driverId === driverId).length;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const requested = Number(params.get('year'));
      if (Number.isFinite(requested) && requested >= 2000 && requested !== this.year()) {
        this.year.set(requested);
        // The first emission is handled by ngOnInit's initial load.
        if (this.initialised) this.load();
      }
    });
  }

  ngOnInit(): void {
    this.csv.getSeasons().subscribe((years) => {
      this.years.set(years);
      if (!this.route.snapshot.queryParamMap.get('year')) {
        this.year.set(years[0] ?? ARCHIVE_END_YEAR);
      }
      this.initialised = true;
      this.load();
    });

    this.csv.getChampions().subscribe((champions) => this.champions.set(champions));
  }

  selectYear(year: number): void {
    if (year === this.year()) return;
    this.year.set(year);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load();
  }

  onYearChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value)) this.selectYear(value);
  }

  canStep(direction: 1 | -1): boolean {
    const years = this.years();
    const index = years.indexOf(this.year());
    const next = index + direction;
    return next >= 0 && next < years.length;
  }

  step(direction: 1 | -1): void {
    const years = this.years();
    const index = years.indexOf(this.year());
    const next = years[index + direction];
    if (next) this.selectYear(next);
  }

  pointsShare(row: StandingsRow, rows: StandingsRow[]): number {
    const leader = rows[0]?.points ?? 0;
    return leader ? Math.max(2, Math.round((row.points / leader) * 100)) : 0;
  }

  teamPointsShare(row: TeamStanding): number {
    const leader = this.teams()[0]?.points ?? 0;
    return leader ? Math.max(2, Math.round((row.points / leader) * 100)) : 0;
  }

  gapToLeader(row: StandingsRow | null): string {
    if (!row) return '—';
    const leader = this.drivers()[0];
    if (!leader || row.driver?.driverId === leader.driver?.driverId) return '—';
    return (Math.round((leader.points - row.points) * 10) / 10).toString();
  }

  exportCsv(): void {
    if (typeof document === 'undefined') return;

    const header = ['year', 'position', 'driver', 'team', 'points', 'wins'];
    const lines = this.drivers().map((row) =>
      [
        this.year(),
        row.position,
        `${row.driver?.forename ?? ''} ${row.driver?.surname ?? ''}`.trim(),
        row.constructor?.name ?? '',
        row.points,
        row.wins,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );

    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `f1-standings-${this.year()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      drivers: this.csv.getSeasonStandings(this.year()),
      teams: this.csv.getConstructorStandings(this.year()),
      summary: this.csv.getSeasonSummary(this.year()),
    }).subscribe(({ drivers, teams, summary }) => {
      this.drivers.set(drivers);
      this.teams.set(teams);
      this.summary.set(summary);
      this.loading.set(false);
    });
  }
}
