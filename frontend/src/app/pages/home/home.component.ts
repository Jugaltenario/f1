import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ChampionRow, SeasonSummary } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { HISTORY_PHOTOS } from '../../core/config/asset-manifest';
import { ordinal } from '../../core/utils/format';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';

interface Overview {
  meta: {
    startYear: number;
    endYear: number;
    dataThrough: string;
    latestRaceDate: string;
    counts: { seasons: number; races: number; results: number };
  } | null;
  season: SeasonSummary;
  champions: ChampionRow[];
  totals: { races: number; drivers: number; constructors: number; circuits: number };
}

interface ExploreLink {
  index: string;
  label: string;
  path: string;
  description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    StatTileComponent,
    DriverAvatarComponent,
    TeamBadgeComponent,
  ],
  template: `
    <div class="page page--wide home">
      @if (overview(); as data) {
        <!-- ------------------------------------------------------------- hero -->
        <section class="hero rise-in">
          <header class="hero__intro">
            <span class="eyebrow">
              Formula 1 archive · {{ data.meta?.startYear }}–{{ data.season.year }}
            </span>
            <h1>The modern era,<br />race by race.</h1>
            <p class="hero__lede">
              Every season since 2000, assembled into one record: results, grids, qualifying,
              championships — and the car that set the standard for all of them.
            </p>
          </header>

          <div class="hero__body">
            <figure class="hero__car">
              @if (mp4Image) {
                <img [src]="mp4Image" alt="McLaren MP4/4, the car that won 15 of 16 races in 1988" />
              }
              <figcaption>
                <span class="hero__car-label">1988 · McLaren MP4/4</span>
                <span class="hero__car-note">15 wins from 16 starts — the benchmark.</span>
              </figcaption>
            </figure>

            <app-panel class="hero__standings">
              <header class="standings-head">
                <div>
                  <span class="eyebrow">
                    {{ data.season.year }} season ·
                    {{ data.season.complete ? 'final' : 'round ' + data.season.roundsCompleted + ' of ' + data.season.roundsTotal }}
                  </span>
                  <h2>Drivers' championship</h2>
                </div>
                <a class="btn btn--ghost btn--sm" routerLink="/standings">Full table</a>
              </header>

              <ol class="board">
                @for (row of topStandings(); track row.driver?.driverId) {
                  <li class="board__row" [class.is-first]="row.position === 1">
                    <span class="board__pos tabular">{{ row.position }}</span>
                    <app-driver-avatar
                      [forename]="row.driver?.forename ?? ''"
                      [surname]="row.driver?.surname ?? ''"
                      [driverRef]="row.driver?.driverRef ?? ''"
                      [color]="row.teamColor"
                      size="sm"
                    />
                    <span class="board__who">
                      <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                      <small>{{ row.constructor?.name }}</small>
                      <span class="board__bar">
                        <span class="board__fill" [style.width.%]="pointsShare(row)" [style.background]="row.teamColor"></span>
                      </span>
                    </span>
                    <span class="board__pts tabular">
                      <strong>{{ row.points }}</strong>
                      <small>{{ row.wins }} {{ row.wins === 1 ? 'win' : 'wins' }}</small>
                    </span>
                  </li>
                }
              </ol>

              <footer class="standings-foot">
                <span>
                  {{ data.season.complete ? 'Champion' : 'Leader' }}:
                  <strong>{{ leaderName() }}</strong>
                </span>
                <span class="standings-foot__note">
                  {{ data.season.complete ? 'Season complete' : data.season.roundsTotal - data.season.roundsCompleted + ' rounds remaining' }}
                </span>
              </footer>
            </app-panel>
          </div>
        </section>

        <!-- -------------------------------------------------------- stat strip -->
        <aside class="stat-strip">
          <app-stat-tile label="Seasons" [value]="data.meta?.counts?.seasons ?? 0" hint="2000 → present" />
          <app-stat-tile label="Grands prix" [value]="data.totals.races" hint="Every round in the archive" />
          <app-stat-tile label="Drivers" [value]="data.totals.drivers" hint="Championship entrants" />
          <app-stat-tile label="Teams · circuits" [value]="data.totals.constructors + ' · ' + data.totals.circuits" hint="Constructors · venues" />
        </aside>

        <!-- ------------------------------------------------------- race cards -->
        <section class="race-grid">
          @if (data.season.latestRace; as latest) {
            <app-panel class="race-card">
              <header class="card-head">
                <span class="eyebrow">Last race · round {{ latest.race.round }}</span>
                <span class="tag">{{ latest.race.date | date: 'd MMM yyyy' }}</span>
              </header>
              <h2 class="race-card__title">{{ latest.race.name }}</h2>
              <p class="race-card__venue">{{ latest.circuit?.name }} · {{ latest.circuit?.location }}</p>

              <ol class="podium">
                @for (row of latest.podium; track row.resultId; let i = $index) {
                  <li class="podium__row">
                    <span class="podium__place tabular" [class.is-win]="i === 0">{{ ordinal(row.position) }}</span>
                    <span class="podium__driver">
                      <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                      <app-team-badge
                        [name]="row.constructor?.name ?? ''"
                        [teamRef]="row.constructor?.constructorRef ?? ''"
                        [color]="row.teamColor"
                        [compact]="true"
                      />
                    </span>
                    <span class="podium__time tabular">{{ row.time || row.status || '—' }}</span>
                  </li>
                }
              </ol>

              <a class="card-link" [routerLink]="['/races', latest.race.raceId]">
                Full classification <span aria-hidden="true">→</span>
              </a>
            </app-panel>
          }

          @if (data.season.nextRace; as next) {
            <app-panel class="race-card race-card--next" variant="inset">
              <header class="card-head">
                <span class="eyebrow">Next · round {{ next.race.round }}</span>
                <span class="tag">{{ daysUntil(next.race.date) }}</span>
              </header>
              <h2 class="race-card__title">{{ next.race.name }}</h2>
              <p class="race-card__venue">{{ next.circuit?.name }} · {{ next.circuit?.location }}</p>

              <dl class="next-meta">
                <div>
                  <dt>Date</dt>
                  <dd class="tabular">{{ next.race.date | date: 'EEEE d MMMM' }}</dd>
                </div>
                <div>
                  <dt>Local start</dt>
                  <dd class="tabular">{{ next.race.time || 'TBC' }}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{{ next.circuit?.country }}</dd>
                </div>
              </dl>

              <a class="card-link" routerLink="/races">Season calendar <span aria-hidden="true">→</span></a>
            </app-panel>
          }
        </section>

        <!-- ------------------------------------------------------- champions -->
        <section class="season-band">
          <header class="section-head">
            <div>
              <span class="eyebrow">Roll of honour</span>
              <h2>Recent champions</h2>
            </div>
            <a class="btn btn--ghost btn--sm" routerLink="/history">Read the history →</a>
          </header>

          <div class="champion-strip">
            @if (latestChampion(); as champ) {
              <article class="champion-feature">
                <span class="champion-feature__year display tabular">{{ champ.year }}</span>
                <div class="champion-feature__who">
                  <h3>{{ champ.driver?.forename }} {{ champ.driver?.surname }}</h3>
                  <app-team-badge
                    [name]="champ.constructor?.name ?? ''"
                    [teamRef]="champ.constructor?.constructorRef ?? ''"
                    [color]="champ.teamColor"
                  />
                </div>
                <div class="champion-feature__stats">
                  <span><strong class="tabular">{{ champ.points }}</strong> points</span>
                  <span><strong class="tabular">{{ champ.wins }}</strong> wins</span>
                  <span><strong class="tabular">{{ titlesFor(champ) }}</strong> titles</span>
                </div>
              </article>
            }

            <ol class="champion-list">
              @for (champ of recentChampions(); track champ.year) {
                <li class="champion-list__row">
                  <span class="champion-list__year tabular">{{ champ.year }}</span>
                  <span class="champion-list__name">
                    {{ champ.driver?.forename }} {{ champ.driver?.surname }}
                  </span>
                  <span class="champion-list__team">
                    <span class="swatch" [style.background]="champ.teamColor"></span>
                    {{ champ.constructor?.name }}
                  </span>
                  <span class="champion-list__pts tabular">{{ champ.points }}</span>
                </li>
              }
            </ol>
          </div>
        </section>

        <!-- --------------------------------------------------------- explore -->
        <section class="explore">
          <header class="section-head">
            <div>
              <span class="eyebrow">Browse</span>
              <h2>The archive</h2>
            </div>
          </header>
          <nav class="explore__grid" aria-label="Archive sections">
            @for (link of links; track link.path) {
              <a class="explore__card" [routerLink]="link.path">
                <span class="explore__index tabular">{{ link.index }}</span>
                <strong>{{ link.label }}</strong>
                <p>{{ link.description }}</p>
                <span class="explore__arrow" aria-hidden="true">→</span>
              </a>
            }
          </nav>
        </section>
      } @else {
        <div class="loading">
          <div class="skeleton" style="height: 320px"></div>
          <div class="skeleton" style="height: 120px"></div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .home {
        display: flex;
        flex-direction: column;
        gap: 2.25rem;
      }

      /* ------------------------------------------------------------- hero */
      .hero {
        padding: clamp(1rem, 2.6vw, 1.9rem);
        background: var(--brushed);
        border: 1px solid var(--border-strong);
        border-radius: var(--r-md);
        box-shadow: var(--shadow);
      }

      .hero__intro {
        max-width: 74ch;
        padding-bottom: 1.4rem;
        margin-bottom: 1.4rem;
        border-bottom: 1px solid rgba(18, 21, 23, 0.12);
      }

      .hero__intro h1 {
        margin: 0.4rem 0 0.7rem;
        font-size: clamp(2.1rem, 5vw, 3.6rem);
        letter-spacing: -0.03em;
        line-height: 1.02;
      }

      .hero__lede {
        font-family: var(--font-serif);
        font-size: clamp(0.98rem, 1.4vw, 1.1rem);
        line-height: 1.6;
        color: var(--text-2);
      }

      .hero__body {
        display: grid;
        grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
        gap: clamp(1rem, 2.4vw, 1.75rem);
        align-items: stretch;
      }

      .hero__car {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: 240px;
        padding: 0;
        margin: 0;
        overflow: hidden;
        border: 1px solid var(--border-strong);
        border-radius: var(--r-sm);
        background: #d8dce0;
      }

      .hero__car img {
        width: 100%;
        height: 100%;
        max-height: 360px;
        object-fit: cover;
        object-position: center 42%;
        filter: saturate(0.85) contrast(1.03);
      }

      .hero__car figcaption {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.7rem 0.85rem;
        background: rgba(250, 251, 252, 0.92);
        border-top: 1px solid var(--border);
        font-size: 0.74rem;
      }

      .hero__car-label {
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-2);
      }

      .hero__car-note {
        color: var(--text-3);
        text-align: right;
      }

      .hero__standings {
        background: var(--surface);
      }

      .standings-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.1rem 0.75rem;
        border-bottom: 1px solid var(--divider);
      }

      .standings-head h2 {
        margin-top: 0.2rem;
        font-size: 1.15rem;
      }

      .board {
        padding: 0.25rem 0;
      }

      .board__row {
        display: grid;
        grid-template-columns: 1.4rem 34px minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        padding: 0.5rem 1.1rem;
        border-bottom: 1px solid var(--divider);
      }

      .board__row:last-child {
        border-bottom: 0;
      }

      .board__pos {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-3);
      }

      .board__row.is-first .board__pos {
        color: var(--accent);
      }

      .board__who {
        display: flex;
        flex-direction: column;
        gap: 0.05rem;
        min-width: 0;
      }

      .board__who strong {
        font-size: 0.86rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .board__who small {
        font-size: 0.7rem;
        color: var(--text-3);
      }

      .board__bar {
        display: block;
        width: 100%;
        height: 2px;
        margin-top: 0.3rem;
        background: var(--surface-3);
        overflow: hidden;
      }

      .board__fill {
        display: block;
        height: 100%;
        opacity: 0.75;
        transition: width var(--dur-slow) var(--ease-out);
      }

      .board__pts {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.2;
      }

      .board__pts strong {
        font-size: 0.95rem;
        font-weight: 700;
      }

      .board__pts small {
        font-size: 0.66rem;
        color: var(--text-3);
      }

      .standings-foot {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.7rem 1.1rem;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
        font-size: 0.74rem;
        color: var(--text-3);
      }

      .standings-foot strong {
        color: var(--text);
      }

      .standings-foot__note {
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-size: 0.66rem;
      }

      /* ------------------------------------------------------- stat strip */
      .stat-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
      }

      .stat-strip app-stat-tile:first-child {
        border-left: 0;
      }

      /* ------------------------------------------------------- race cards */
      .race-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .race-card {
        display: flex;
        flex-direction: column;
        padding: 1.1rem 1.2rem;
      }

      .race-card--next {
        box-shadow: none;
      }

      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.55rem;
      }

      .race-card__title {
        font-size: 1.3rem;
        letter-spacing: -0.02em;
      }

      .race-card__venue {
        margin-top: 0.15rem;
        font-size: 0.8rem;
        color: var(--text-3);
      }

      .podium {
        margin: 1rem 0 0.9rem;
        border-top: 1px solid var(--divider);
      }

      .podium__row {
        display: grid;
        grid-template-columns: 2.4rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--divider);
      }

      .podium__place {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--text-3);
      }

      .podium__place.is-win {
        color: var(--accent);
      }

      .podium__driver {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }

      .podium__driver strong {
        font-size: 0.88rem;
        font-weight: 600;
      }

      .podium__time {
        font-size: 0.78rem;
        color: var(--text-3);
      }

      .next-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin: 1rem 0 1.1rem;
        padding: 0.9rem 0;
        border-top: 1px solid var(--divider);
        border-bottom: 1px solid var(--divider);
      }

      .next-meta dt {
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .next-meta dd {
        margin-top: 0.2rem;
        font-size: 0.84rem;
        font-weight: 600;
      }

      .card-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text);
      }

      .card-link span {
        transition: translate var(--dur) var(--ease);
      }

      .card-link:hover span {
        translate: 3px 0;
      }

      /* --------------------------------------------------------- champions */
      .section-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .section-head h2 {
        font-size: clamp(1.3rem, 2.4vw, 1.7rem);
        margin-top: 0.2rem;
      }

      .champion-strip {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 1rem;
      }

      .champion-feature {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.25rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-top: 3px solid var(--text);
        border-radius: var(--r-md);
      }

      .champion-feature__year {
        font-size: 2.4rem;
        color: var(--text-3);
        line-height: 1;
      }

      .champion-feature__who h3 {
        font-size: 1.25rem;
        margin-bottom: 0.3rem;
      }

      .champion-feature__stats {
        display: flex;
        gap: 1.4rem;
        padding-top: 0.8rem;
        border-top: 1px solid var(--divider);
        font-size: 0.74rem;
        color: var(--text-3);
      }

      .champion-feature__stats strong {
        display: block;
        font-size: 1.05rem;
        color: var(--text);
      }

      .champion-list {
        display: flex;
        flex-direction: column;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        overflow: hidden;
      }

      .champion-list__row {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr) minmax(0, 0.9fr) auto;
        align-items: center;
        gap: 0.8rem;
        padding: 0.62rem 1rem;
        border-bottom: 1px solid var(--divider);
        font-size: 0.84rem;
      }

      .champion-list__row:last-child {
        border-bottom: 0;
      }

      .champion-list__year {
        font-weight: 700;
        color: var(--text-3);
      }

      .champion-list__name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .champion-list__team {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.74rem;
        color: var(--text-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .swatch {
        width: 6px;
        height: 6px;
        flex: 0 0 auto;
        border-radius: 1px;
      }

      .champion-list__pts {
        font-weight: 700;
      }

      /* ----------------------------------------------------------- explore */
      .explore__grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .explore__card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 1.05rem 1.1rem 1.2rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        color: var(--text);
        transition:
          border-color var(--dur) var(--ease),
          box-shadow var(--dur) var(--ease);
      }

      .explore__card:hover {
        border-color: var(--border-strong);
        box-shadow: var(--shadow-sm);
        color: var(--text);
      }

      .explore__index {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--text-4);
      }

      .explore__card strong {
        font-size: 1rem;
      }

      .explore__card p {
        font-size: 0.78rem;
        line-height: 1.5;
        color: var(--text-3);
      }

      .explore__arrow {
        position: absolute;
        top: 1rem;
        right: 1rem;
        font-size: 0.9rem;
        color: var(--text-4);
        transition:
          translate var(--dur) var(--ease),
          color var(--dur) var(--ease);
      }

      .explore__card:hover .explore__arrow {
        translate: 2px -2px;
        color: var(--text);
      }

      .loading {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      @media (max-width: 1080px) {
        .hero__body {
          grid-template-columns: 1fr;
        }

        .hero__car {
          min-height: 200px;
        }

        .explore__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 820px) {
        .race-grid,
        .champion-strip {
          grid-template-columns: 1fr;
        }

        .stat-strip {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .stat-strip app-stat-tile:nth-child(3) {
          border-left: 0;
        }

        .stat-strip app-stat-tile:nth-child(n + 3) {
          border-top: 1px solid var(--divider);
        }
      }

      @media (max-width: 560px) {
        .explore__grid {
          grid-template-columns: 1fr;
        }

        .champion-list__row {
          grid-template-columns: 2.6rem minmax(0, 1fr) auto;
        }

        .champion-list__team {
          display: none;
        }

        .next-meta {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly csv = inject(CSVDataService);

  readonly overview = signal<Overview | null>(null);

  readonly season = computed(() => this.overview()?.season ?? null);
  readonly topStandings = computed(() => (this.overview()?.season.standings ?? []).slice(0, 5));
  readonly recentChampions = computed(() => (this.overview()?.champions ?? []).slice(0, 6));
  readonly latestChampion = computed(() => this.recentChampions()[0] ?? null);
  readonly leaderName = computed(() => {
    const leader = this.overview()?.season.leader;
    return leader?.driver ? `${leader.driver.forename} ${leader.driver.surname}` : '—';
  });

  readonly ordinal = ordinal;
  readonly mp4Image = HISTORY_PHOTOS['mp4-4'] ? `/assets/images/history/${HISTORY_PHOTOS['mp4-4']}` : null;

  readonly links: ExploreLink[] = [
    { index: '01', label: 'Drivers', path: '/drivers', description: 'Every career since 2000, with podiums, poles and titles.' },
    { index: '02', label: 'Teams', path: '/constructors', description: 'Constructors, their liveries and championship pedigree.' },
    { index: '03', label: 'Circuits', path: '/circuits', description: 'Every venue, its map and the races it has hosted.' },
    { index: '04', label: 'Races', path: '/races', description: 'Classifications, starting grids and qualifying.' },
  ];

  ngOnInit(): void {
    this.csv.getOverview().subscribe((data) => this.overview.set(data as Overview));
  }

  pointsShare(row: { points: number }): number {
    const leader = this.topStandings()[0]?.points ?? 0;
    if (!leader) return 0;
    return Math.max(3, Math.round((row.points / leader) * 100));
  }

  titlesFor(champ: ChampionRow): number {
    return (this.overview()?.champions ?? []).filter(
      (row) => row.driver?.driverId === champ.driver?.driverId,
    ).length;
  }

  daysUntil(date: string): string {
    const target = new Date(`${date}T00:00:00Z`).getTime();
    const today = Date.now();
    const days = Math.ceil((target - today) / 86_400_000);
    if (days <= 0) return 'Race week';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }
}
