import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EnrichedResult, Race, RaceWithResults } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { OPENF1_START_YEAR, ARCHIVE_END_YEAR } from '../../core/config/data.config';
import { countryFlag } from '../../core/utils/country';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

type RaceTab = 'race' | 'qualifying';

@Component({
  selector: 'app-race-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    PageHeaderComponent,
    StatTileComponent,
    DriverAvatarComponent,
    TeamBadgeComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page race-detail">
      @if (loading()) {
        <app-skeleton-loader [count]="2" [height]="36" />
        <div class="skeleton-grid">
          <app-skeleton-loader [count]="1" [height]="220" />
          <app-skeleton-loader [count]="2" [height]="100" />
        </div>
        <app-skeleton-loader [count]="8" [height]="54" />
      } @else if (!detail()) {
        <app-empty-state
          icon="🏁"
          title="That race is not in the archive"
          [message]="'It may sit outside the 2000 → ' + archiveEnd + ' window, or the link is out of date.'"
          actionLabel="Back to the calendar"
          actionLink="/races"
        />
      } @else if (detail(); as d) {
        <nav class="crumbs" aria-label="Breadcrumb">
          <a routerLink="/races">Races</a>
          <span aria-hidden="true">/</span>
          <a routerLink="/races" [queryParams]="{ year: d.race.year }">{{ d.race.year }} season</a>
          <span aria-hidden="true">/</span>
          <span>Round {{ d.race.round }}</span>
        </nav>

        <app-page-header
          [eyebrow]="d.race.year + ' · Round ' + d.race.round + ' · ' + flag(d.circuit?.country ?? '') + ' ' + (d.circuit?.country ?? '')"
          [title]="d.race.name"
          [subtitle]="(d.circuit?.name ?? '') + ' · ' + (d.circuit?.location ?? '') + ' · ' + (d.race.date | date: 'EEEE d MMMM yyyy')"
        >
          <div class="round-nav">
            <a
              class="btn btn--sm"
              routerLink="/races"
              [queryParams]="{ year: d.race.year }"
              aria-label="Back to season calendar"
            >
              Calendar
            </a>
            @if (previousRace(); as prev) {
              <a class="btn btn--ghost btn--sm" [routerLink]="['/races', prev.raceId]" [attr.aria-label]="'Previous round: ' + prev.name">
                ← R{{ prev.round }}
              </a>
            }
            @if (nextRace(); as next) {
              <a class="btn btn--ghost btn--sm" [routerLink]="['/races', next.raceId]" [attr.aria-label]="'Next round: ' + next.name">
                R{{ next.round }} →
              </a>
            }
          </div>
        </app-page-header>

        <!-- ------------------------------------------------------------- hero -->
        @if (winner(); as w) {
          <section class="hero panel" [style.--hero-color]="w.teamColor">
            <div class="hero__winner">
              <span class="eyebrow">Race winner</span>
              <div class="hero__driver">
                <app-driver-avatar
                  [forename]="w.driver?.forename ?? ''"
                  [surname]="w.driver?.surname ?? ''"
                  [driverRef]="w.driver?.driverRef ?? ''"
                  [color]="w.teamColor"
                  size="xl"
                />
                <div class="hero__driver-copy">
                  <h2>{{ w.driver?.forename }} {{ w.driver?.surname }}</h2>
                  <app-team-badge
                    [name]="w.constructor?.name ?? ''"
                    [teamRef]="w.constructor?.constructorRef ?? ''"
                    [color]="w.teamColor"
                  />
                  <span class="hero__time tabular">{{ w.time || w.status || '—' }}</span>
                </div>
              </div>

              <div class="hero__facts">
                <span><strong>{{ w.laps }}</strong> laps</span>
                <span><strong>{{ w.points }}</strong> points</span>
                <span><strong>P{{ w.grid || '—' }}</strong> on the grid</span>
              </div>
            </div>

            <div class="hero__right">
              <ol class="hero__podium">
                @for (row of d.podium; track row.resultId; let i = $index) {
                  <li class="podium-row">
                    <span class="podium-row__place" [class.is-win]="i === 0">{{ ordinal(row.position) }}</span>
                    <app-driver-avatar
                      [forename]="row.driver?.forename ?? ''"
                      [surname]="row.driver?.surname ?? ''"
                      [driverRef]="row.driver?.driverRef ?? ''"
                      [color]="row.teamColor"
                      size="sm"
                    />
                    <span class="podium-row__who">
                      <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                      <small>{{ row.constructor?.name }}</small>
                    </span>
                    <span class="podium-row__time tabular">{{ gapText(row) }}</span>
                  </li>
                }
              </ol>

              @if (d.fastestLap; as fl) {
                <div class="hero__fastest">
                  <span class="fastest__label">
                    <span class="fastest__dot" aria-hidden="true"></span>
                    Fastest lap
                  </span>
                  <span class="fastest__value tabular">{{ fl.fastestLapTime }}</span>
                  <span class="fastest__driver">
                    {{ fl.driver?.forename }} {{ fl.driver?.surname }}
                    @if (fl.fastestLapSpeed) {
                      · {{ fl.fastestLapSpeed }} km/h
                    }
                  </span>
                </div>
              }
            </div>
          </section>
        }

        <!-- ------------------------------------------------------------- stats -->
        <section class="stat-grid">
          <app-stat-tile label="Round" [value]="d.race.round" [hint]="d.race.year + ' season'" icon="🗓️" accent="#f2c14e" />
          <app-stat-tile label="Classified" [value]="classifiedCount()" hint="Drivers with a finishing position" icon="🏁" accent="#229971" />
          <app-stat-tile label="Retirements" [value]="retirementCount()" hint="Did not finish" icon="🛠️" accent="#ff2d20" />
          <app-stat-tile label="Pole position" [value]="poleSitter() ?? '—'" [hint]="poleTime() ? 'Qualifying · ' + poleTime() : 'Qualifying'" icon="⚡" accent="#64c4ff" />
        </section>

        <!-- -------------------------------------------------------------- tabs -->
        <div class="results-head">
          <div class="chip-set" role="tablist" aria-label="Race data">
            <button
              type="button"
              role="tab"
              class="chip"
              [class.is-active]="tab() === 'race'"
              [attr.aria-selected]="tab() === 'race'"
              (click)="tab.set('race')"
            >
              Classification
            </button>
            <button
              type="button"
              role="tab"
              class="chip"
              [class.is-active]="tab() === 'qualifying'"
              [attr.aria-selected]="tab() === 'qualifying'"
              (click)="tab.set('qualifying')"
            >
              Qualifying
            </button>
          </div>

          <div class="results-head__actions">
            @if (d.race.year >= openF1Start) {
              <a class="btn btn--sm" routerLink="/live" [queryParams]="{ year: d.race.year }">
                OpenF1 session replay
              </a>
            }
            <a class="btn btn--ghost btn--sm" routerLink="/standings" [queryParams]="{ year: d.race.year }">
              {{ d.race.year }} standings →
            </a>
          </div>
        </div>

        @if (tab() === 'race') {
          <app-panel class="table-card">
            <div class="table-scroll">
              <table class="data-table">
                <caption class="sr-only">{{ d.race.name }} classification</caption>
                <thead>
                  <tr>
                    <th scope="col" class="col-pos">Pos</th>
                    <th scope="col">Driver</th>
                    <th scope="col">Team</th>
                    <th scope="col" class="col-num">Grid</th>
                    <th scope="col" class="col-num">Laps</th>
                    <th scope="col">Time / status</th>
                    <th scope="col" class="col-num">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of d.results; track row.resultId) {
                    <tr [class.is-winner]="row.position === 1" [class.is-retired]="row.position === null">
                      <td class="col-pos">
                        <span class="pos-badge" [class.pos-badge--gold]="row.position === 1">{{ row.position ?? row.positionText }}</span>
                      </td>
                      <td>
                        <a class="driver-cell" routerLink="/drivers" [queryParams]="{ driver: row.driverId }">
                          <app-driver-avatar
                            [forename]="row.driver?.forename ?? ''"
                            [surname]="row.driver?.surname ?? ''"
                            [driverRef]="row.driver?.driverRef ?? ''"
                            [color]="row.teamColor"
                            size="xs"
                          />
                          <span class="driver-cell__name">
                            <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                            @if (row.fastestLapTime) {
                              <span class="fastest-tag">FL {{ row.fastestLapTime }}</span>
                            }
                          </span>
                        </a>
                      </td>
                      <td>
                        <app-team-badge
                          [name]="row.constructor?.name ?? ''"
                          [teamRef]="row.constructor?.constructorRef ?? ''"
                          [color]="row.teamColor"
                          [compact]="true"
                        />
                      </td>
                      <td class="col-num tabular">
                        {{ row.grid || '—' }}
                        @if (gridDelta(row); as delta) {
                          <span class="delta" [class.delta--up]="delta.startsWith('+')" [class.delta--down]="delta.startsWith('-')">{{ delta }}</span>
                        }
                      </td>
                      <td class="col-num tabular">{{ row.laps }}</td>
                      <td class="col-time tabular">{{ gapText(row) }}</td>
                      <td class="col-num tabular">{{ row.points }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-panel>
        } @else {
          @if (d.qualifying.length) {
            <app-panel class="table-card">
              <div class="table-scroll">
                <table class="data-table">
                  <caption class="sr-only">{{ d.race.name }} qualifying</caption>
                  <thead>
                    <tr>
                      <th scope="col" class="col-pos">Pos</th>
                      <th scope="col">Driver</th>
                      <th scope="col">Team</th>
                      <th scope="col" class="col-num">Q1</th>
                      <th scope="col" class="col-num">Q2</th>
                      <th scope="col" class="col-num">Q3</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of d.qualifying; track row.qualifyId) {
                      <tr [class.is-winner]="row.position === 1">
                        <td class="col-pos">
                          <span class="pos-badge" [class.pos-badge--gold]="row.position === 1">{{ row.position }}</span>
                        </td>
                        <td>
                          <a class="driver-cell" routerLink="/drivers" [queryParams]="{ driver: row.driverId }">
                            <app-driver-avatar
                              [forename]="row.driver?.forename ?? ''"
                              [surname]="row.driver?.surname ?? ''"
                              [driverRef]="row.driver?.driverRef ?? ''"
                              [color]="teamColorOf(row.driverId)"
                              size="xs"
                            />
                            <strong>{{ row.driver?.forename }} {{ row.driver?.surname }}</strong>
                          </a>
                        </td>
                        <td>
                          <app-team-badge
                            [name]="row.constructor?.name ?? ''"
                            [teamRef]="row.constructor?.constructorRef ?? ''"
                            [color]="teamColorOf(row.driverId)"
                            [compact]="true"
                          />
                        </td>
                        <td class="col-num tabular">{{ row.q1 ?? '—' }}</td>
                        <td class="col-num tabular">{{ row.q2 ?? '—' }}</td>
                        <td class="col-num tabular">{{ row.q3 ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </app-panel>
          } @else {
            <app-empty-state
              icon="⏱️"
              title="Qualifying data is unavailable for this race"
              message="The archive only carries qualifying sessions for rounds where the data was published."
              actionLabel="View the race classification"
              actionLink="/races"
            />
          }
        }

        <!-- -------------------------------------------------------------- meta -->
        <section class="meta-grid">
          <app-panel variant="plain">
            <div class="meta-card">
              <span class="eyebrow">Circuit</span>
              <h3>{{ d.circuit?.name ?? '—' }}</h3>
              <p class="muted">{{ d.circuit?.location }}, {{ d.circuit?.country }}</p>
              <div class="meta-card__facts">
                <span>{{ flag(d.circuit?.country ?? '') }} {{ d.circuit?.country }}</span>
                @if (d.circuit?.lat !== null && d.circuit?.lng !== null) {
                  <span class="tabular">{{ d.circuit?.lat?.toFixed(3) }}, {{ d.circuit?.lng?.toFixed(3) }}</span>
                }
              </div>
              <a class="meta-link" routerLink="/circuits" [queryParams]="{ circuit: d.circuit?.circuitRef }">
                Explore this circuit →
              </a>
            </div>
          </app-panel>

          <app-panel variant="plain">
            <div class="meta-card">
              <span class="eyebrow">Fastest lap</span>
              @if (d.fastestLap; as fl) {
                <h3 class="tabular">{{ fl.fastestLapTime }}</h3>
                <p class="muted">
                  {{ fl.driver?.forename }} {{ fl.driver?.surname }} · {{ fl.constructor?.name }}
                </p>
                <div class="meta-card__facts">
                  <span>{{ fl.fastestLapSpeed }} km/h</span>
                  <span>{{ fl.laps }} laps completed</span>
                </div>
              } @else {
                <h3>—</h3>
                <p class="muted">No fastest-lap data was recorded for this round.</p>
              }
              <a class="meta-link" routerLink="/drivers" [queryParams]="{ driver: d.fastestLap?.driverId }">
                Driver profile →
              </a>
            </div>
          </app-panel>

          <app-panel variant="plain">
            <div class="meta-card">
              <span class="eyebrow">Season context</span>
              <h3>Round {{ d.race.round }} of {{ d.race.year }}</h3>
              <p class="muted">
                {{ d.results.length }} starters · {{ classifiedCount() }} classified ·
                {{ retirementCount() }} retirements
              </p>
              <div class="meta-card__facts">
                <span>{{ d.podium.length }} podium finishers</span>
                <span>{{ d.qualifying.length ? 'Qualifying archived' : 'No qualifying archive' }}</span>
              </div>
              <a class="meta-link" routerLink="/races" [queryParams]="{ year: d.race.year, circuit: d.circuit?.circuitRef }">
                All {{ d.race.year }} races at this circuit →
              </a>
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

      .crumbs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.1rem;
        font-size: 0.74rem;
        color: var(--text-3);
      }

      .crumbs a {
        color: var(--text-3);
      }

      .crumbs a:hover {
        color: var(--accent);
      }

      .round-nav {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }

      /* ---------------------------------------------------------------- hero */
      .hero {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        gap: clamp(1.25rem, 3vw, 2.5rem);
        padding: clamp(1.25rem, 3vw, 2rem);
        border-radius: var(--r-lg);
        border-top: 2px solid var(--hero-color, var(--border));
        overflow: hidden;
        margin-bottom: 1.25rem;
      }

      .hero__winner {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero__driver {
        display: flex;
        align-items: center;
        gap: 1.1rem;
      }

      .hero__driver-copy {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        min-width: 0;
      }

      .hero__driver-copy h2 {
        font-size: clamp(1.5rem, 3.4vw, 2.3rem);
        letter-spacing: -0.03em;
        line-height: 1.02;
      }

      .hero__time {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .hero__facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.6rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--divider);
        font-size: 0.76rem;
        color: var(--text-3);
      }

      .hero__facts strong {
        color: var(--text);
        font-size: 0.95rem;
        font-weight: 700;
      }

      .hero__right {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding: 0.4rem 0.2rem;
      }

      .hero__podium {
        display: flex;
        flex-direction: column;
      }

      .podium-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--divider);
      }

      .podium-row__place {
        width: 1.9rem;
        font-family: var(--font-display);
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--text-3);
      }

      .podium-row__place.is-win {
        color: var(--accent);
      }

      .podium-row__who {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }

      .podium-row__who strong {
        font-size: 0.8rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .podium-row__who small {
        font-size: 0.66rem;
        color: var(--text-3);
      }

      .podium-row__time {
        font-size: 0.72rem;
        color: var(--text-2);
        white-space: nowrap;
      }

      .hero__fastest {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.85rem 1rem;
        border-radius: var(--r-md);
        background: color-mix(in srgb, #b46bff 10%, var(--surface-2));
        border: 1px solid color-mix(in srgb, #b46bff 28%, var(--border));
      }

      .fastest__label {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .fastest__dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #b46bff;
        box-shadow: 0 0 10px #b46bff;
      }

      .fastest__value {
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .fastest__driver {
        font-size: 0.7rem;
        color: var(--text-2);
      }

      /* --------------------------------------------------------------- stats */
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      /* ---------------------------------------------------------------- tabs */
      .results-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.9rem;
      }

      .results-head__actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      /* --------------------------------------------------------------- table */
      .table-card {
        margin-bottom: 1.5rem;
      }

      .table-scroll {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        min-width: 760px;
      }

      .data-table th {
        position: sticky;
        top: 0;
        padding: 0.75rem 1rem;
        text-align: left;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
        background: var(--bg-2);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }

      .data-table td {
        padding: 0.55rem 1rem;
        border-bottom: 1px solid var(--divider);
        vertical-align: middle;
      }

      .data-table tbody tr {
        transition: background var(--dur-fast) var(--ease);
      }

      .data-table tbody tr:hover {
        background: var(--surface-2);
      }

      .data-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .data-table tr.is-winner {
        background: color-mix(in srgb, var(--accent) 7%, transparent);
      }

      .data-table tr.is-retired {
        opacity: 0.72;
      }

      .col-pos {
        width: 3.4rem;
      }

      .col-num {
        width: 4.5rem;
        text-align: right;
      }

      .col-time {
        white-space: nowrap;
      }

      .pos-badge {
        display: inline-grid;
        place-items: center;
        min-width: 1.65rem;
        height: 1.65rem;
        padding: 0 0.3rem;
        border-radius: 7px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-family: var(--font-display);
        font-size: 0.75rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      .pos-badge--gold {
        background: color-mix(in srgb, var(--accent) 22%, var(--surface-2));
        border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
        color: var(--accent);
      }

      .driver-cell {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        color: var(--text);
        min-width: 0;
      }

      .driver-cell:hover strong {
        color: var(--accent);
      }

      .driver-cell__name {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }

      .driver-cell__name strong {
        font-size: 0.82rem;
        font-weight: 600;
        white-space: nowrap;
        transition: color var(--dur-fast) var(--ease);
      }

      .fastest-tag {
        font-size: 0.58rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #c89bff;
      }

      .delta {
        margin-left: 0.3rem;
        font-size: 0.62rem;
        font-weight: 600;
      }

      .delta--up {
        color: #45d18b;
      }

      .delta--down {
        color: #ff6b62;
      }

      /* ---------------------------------------------------------------- meta */
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .meta-card {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        padding: 1.25rem;
        height: 100%;
      }

      .meta-card h3 {
        font-size: 1.05rem;
        letter-spacing: -0.02em;
      }

      .meta-card p {
        font-size: 0.78rem;
      }

      .meta-card__facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1rem;
        margin-top: auto;
        padding-top: 0.8rem;
        border-top: 1px solid var(--divider);
        font-size: 0.7rem;
        color: var(--text-3);
      }

      .meta-link {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-2);
        margin-top: 0.5rem;
      }

      .meta-link:hover {
        color: var(--accent);
      }

      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin: 1rem 0;
      }

      @media (max-width: 1020px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .stat-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .meta-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .stat-grid {
          grid-template-columns: 1fr;
        }

        .hero__driver {
          align-items: flex-start;
        }

        .round-nav {
          width: 100%;
        }
      }
    `,
  ],
})
export class RaceDetailComponent implements OnInit {
  private readonly csv = inject(CSVDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly openF1Start = OPENF1_START_YEAR;
  readonly archiveEnd = ARCHIVE_END_YEAR;
  readonly loading = signal(true);
  readonly detail = signal<RaceWithResults | null>(null);
  readonly seasonRaces = signal<Race[]>([]);
  readonly tab = signal<RaceTab>('race');

  readonly winner = computed(() => this.detail()?.results[0] ?? null);

  readonly classifiedCount = computed(
    () => this.detail()?.results.filter((row) => row.position !== null).length ?? 0,
  );

  readonly retirementCount = computed(
    () => this.detail()?.results.filter((row) => row.position === null).length ?? 0,
  );

  readonly poleSitter = computed(() => {
    const pole = this.detail()?.qualifying[0]?.driver;
    return pole ? `${pole.forename} ${pole.surname}` : null;
  });

  readonly poleTime = computed(() => {
    const pole = this.detail()?.qualifying[0];
    return pole?.q3 ?? pole?.q2 ?? pole?.q1 ?? '';
  });

  readonly previousRace = computed(() => {
    const races = this.seasonRaces();
    const current = this.detail()?.race;
    if (!current) return null;
    const index = races.findIndex((race) => race.raceId === current.raceId);
    return index > 0 ? races[index - 1] : null;
  });

  readonly nextRace = computed(() => {
    const races = this.seasonRaces();
    const current = this.detail()?.race;
    if (!current) return null;
    const index = races.findIndex((race) => race.raceId === current.raceId);
    return index >= 0 && index < races.length - 1 ? races[index + 1] : null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raceId = Number(params.get('id'));
      if (!Number.isFinite(raceId)) return;
      this.load(raceId);
    });
  }

  ngOnInit(): void {
    // The param map subscription above handles the initial load.
  }

  flag(country: string): string {
    return countryFlag(country);
  }

  ordinal(position: number | null): string {
    if (position === null) return '—';
    const suffix = position % 100 >= 11 && position % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][position % 10] ?? 'th';
    return `${position}${suffix}`;
  }

  gapText(row: EnrichedResult): string {
    return row.time || row.status || '—';
  }

  gridDelta(row: EnrichedResult): string | null {
    if (!row.grid || row.position === null || row.grid <= 0) return null;
    const delta = row.grid - row.position;
    if (delta === 0) return null;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  teamColorOf(driverId: number): string {
    return this.detail()?.results.find((row) => row.driverId === driverId)?.teamColor ?? '#8b8f98';
  }

  private load(raceId: number): void {
    this.loading.set(true);
    this.csv.getRace(raceId).subscribe((detail) => {
      this.detail.set(detail);
      this.loading.set(false);

      if (!detail) {
        this.seasonRaces.set([]);
        return;
      }

      this.csv.getRaces(detail.race.year).subscribe((races) => {
        this.seasonRaces.set(races.slice().sort((a, b) => a.round - b.round));
      });
    });
  }
}
