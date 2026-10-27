import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  LiveDriverRow,
  OpenF1CarData,
  OpenF1Driver,
  OpenF1Lap,
  OpenF1Meeting,
  OpenF1RaceControl,
  OpenF1Session,
  OpenF1SessionResult,
  OpenF1Weather,
} from '../../core/models/openf1.model';
import { OpenF1Service } from '../../core/services/openf1.service';
import { CURRENT_YEAR, OPENF1_START_YEAR } from '../../core/config/data.config';
import { countryFlag } from '../../core/utils/country';
import { formatLapTime } from '../../core/utils/format';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TelemetryChartComponent } from '../../shared/components/telemetry-chart/telemetry-chart.component';

interface LiveBoard {
  drivers: OpenF1Driver[];
  rows: LiveDriverRow[];
  laps: OpenF1Lap[];
  raceControl: OpenF1RaceControl[];
  weather: OpenF1Weather | null;
  result: OpenF1SessionResult[];
}

@Component({
  selector: 'app-live',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    PageHeaderComponent,
    StatTileComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
    TelemetryChartComponent,
  ],
  template: `
    <div class="page page--wide live">
      <app-page-header
        eyebrow="OpenF1 · 2023 → today"
        title="Live timing"
        subtitle="Replay any session from the hybrid era — positions, intervals, tyres, pit stops, race control and car telemetry. Historical sessions are free; add an OpenF1 token to poll a live session."
      >
        <div class="year-control panel">
          <button type="button" class="year-control__step" aria-label="Previous season" [disabled]="!canStep(-1)" (click)="stepYear(-1)">←</button>
          <div class="field year-control__select">
            <select [value]="year()" (change)="onYearChange($event)" aria-label="Season">
              @for (y of years; track y) {
                <option [value]="y">{{ y }} season</option>
              }
            </select>
          </div>
          <button type="button" class="year-control__step" aria-label="Next season" [disabled]="!canStep(1)" (click)="stepYear(1)">→</button>
        </div>
      </app-page-header>

      <!-- --------------------------------------------------------- session picker -->
      <section class="picker panel">
        <div class="picker__row">
          <div class="field picker__meeting">
            <select [value]="meetingKey() ?? ''" (change)="onMeetingChange($event)" aria-label="Grand prix">
              @for (meeting of meetings(); track meeting.meeting_key) {
                <option [value]="meeting.meeting_key">
                  {{ meeting.meeting_name }} · {{ meeting.location }}
                </option>
              }
            </select>
          </div>

          <div class="picker__meta">
            @if (selectedMeeting(); as meeting) {
              <span class="picker__flag" aria-hidden="true">{{ flagFor(meeting.country_name) }}</span>
              <span class="picker__where">{{ meeting.circuit_short_name }}</span>
              <span class="dim">{{ meeting.date_start | date: 'd MMM' }} – {{ meeting.date_end | date: 'd MMM yyyy' }}</span>
            }
          </div>

          <div class="spacer"></div>

          <button
            type="button"
            class="btn btn--sm"
            [class.is-on]="tokenPanel()"
            (click)="tokenPanel.set(!tokenPanel())"
          >
            <span class="token-dot" [class.is-on]="hasToken()" aria-hidden="true"></span>
            {{ hasToken() ? 'Token active' : 'Add token' }}
          </button>
        </div>

        @if (tokenPanel()) {
          <div class="token-panel">
            <p>
              OpenF1's free tier serves historical sessions. Real-time polling needs a paid subscription — paste your
              token to unlock 15-second refresh. It is stored only in this browser and sent only to
              <code>api.openf1.org</code>.
            </p>
            <div class="token-panel__row">
              <label class="field token-panel__input">
                <input
                  type="password"
                  autocomplete="off"
                  placeholder="OpenF1 bearer token"
                  [value]="tokenInput()"
                  (input)="onTokenInput($event)"
                  aria-label="OpenF1 bearer token"
                />
              </label>
              <button type="button" class="btn btn--primary btn--sm" (click)="saveToken()">Save token</button>
              @if (hasToken()) {
                <button type="button" class="btn btn--ghost btn--sm" (click)="clearToken()">Remove</button>
              }
            </div>
            @if (tokenSaved()) {
              <span class="token-panel__status">Token saved. Showing {{ polling() ? 'live polling' : 'replay' }} mode.</span>
            }
          </div>
        }

        @if (loadingSessions()) {
          <div class="session-strip">
            <app-skeleton-loader [count]="1" [height]="38" />
          </div>
        } @else {
          <div class="session-strip" role="tablist" aria-label="Sessions">
            @for (session of meetingSessions(); track session.session_key) {
              <button
                type="button"
                role="tab"
                class="session-chip"
                [class.is-active]="session.session_key === sessionKey()"
                [attr.aria-selected]="session.session_key === sessionKey()"
                (click)="selectSession(session)"
              >
                <span class="session-chip__name">{{ session.session_name }}</span>
                <span class="session-chip__date">{{ session.date_start | date: 'EEE d MMM · HH:mm' }}</span>
              </button>
            }
            @if (!meetingSessions().length) {
              <span class="dim">No sessions published for this meeting yet.</span>
            }
          </div>
        }
      </section>

      <!-- ---------------------------------------------------------------- board -->
      @if (loadingBoard()) {
        <div class="board-loading">
          <app-skeleton-loader [count]="1" [height]="70" />
          <app-skeleton-loader [count]="8" [height]="46" />
        </div>
      } @else if (boardError()) {
        <app-empty-state
          icon="📡"
          title="Could not reach OpenF1"
          message="The session data did not load. Check your connection, or try a different session."
          actionLabel="Back to the archive"
          actionLink="/races"
        />
      } @else if (board(); as b) {
        <!-- session banner -->
        <section class="session-banner panel" [style.--session-color]="sessionColor()">
          <div class="session-banner__main">
            <div class="session-banner__title">
              <span class="pill" [class.pill--live]="isLive() && hasToken()">
                <span class="pulse-dot" aria-hidden="true"></span>
                {{ isLive() ? (hasToken() ? 'Live session' : 'Happening now · replay') : 'Replay' }}
              </span>
              @if (session(); as s) {
                <h2>{{ s.circuit_short_name }} · {{ s.session_name }}</h2>
                <p class="muted">
                  {{ s.location }}, {{ s.country_name }} · {{ s.date_start | date: 'EEEE d MMMM yyyy, HH:mm' }} ·
                  session {{ s.session_key }}
                </p>
              }
            </div>

            <div class="session-banner__actions">
              @if (hasToken()) {
                <button
                  type="button"
                  class="btn btn--sm"
                  [class.is-on]="polling()"
                  (click)="togglePolling()"
                >
                  {{ polling() ? 'Pause polling' : 'Resume polling' }}
                </button>
              }
              <button type="button" class="btn btn--sm" (click)="refresh()">Refresh</button>
              @if (session(); as s) {
                <a class="btn btn--ghost btn--sm" routerLink="/races" [queryParams]="{ year: s.year }">
                  {{ s.year }} calendar →
                </a>
              }
            </div>
          </div>
        </section>

        <!-- stats -->
        <section class="stat-grid">
          <app-stat-tile label="Drivers" [value]="b.rows.length" hint="In this session" icon="🪖" accent="#ff2d20" />
          <app-stat-tile label="Leader laps" [value]="leaderLaps()" hint="Completed by P1" icon="🏁" accent="#f2c14e" />
          <app-stat-tile label="Session best" [value]="formatLap(sessionBest())" hint="Fastest lap so far" icon="⚡" accent="#b46bff" />
          <app-stat-tile
            label="Track"
            [value]="trackTempLabel()"
            [hint]="weatherHint()"
            icon="🌡️"
            accent="#64c4ff"
          />
        </section>

        <div class="board">
          <!-- ------------------------------------------------------ timing table -->
          <app-panel class="timing-card">
            <div class="card-head">
              <div>
                <span class="eyebrow">Timing tower</span>
                <h2>Classification</h2>
              </div>
              @if (b.result.length) {
                <span class="pill">Final result</span>
              } @else {
                <span class="pill">Running order</span>
              }
            </div>

            <div class="timing-scroll">
              <table class="timing-table">
                <thead>
                  <tr>
                    <th scope="col" class="t-pos">P</th>
                    <th scope="col">Driver</th>
                    <th scope="col" class="t-num">Gap</th>
                    <th scope="col" class="t-num">Int</th>
                    <th scope="col" class="t-num">Laps</th>
                    <th scope="col" class="t-num">Last</th>
                    <th scope="col" class="t-num">Best</th>
                    <th scope="col">Tyre</th>
                    <th scope="col" class="t-num">Pit</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of b.rows; track row.driver.driver_number) {
                    <tr [class.is-leader]="row.position === 1" [class.is-pit]="row.inPit">
                      <td class="t-pos">
                        <span class="pos" [class.pos--podium]="row.position <= 3">{{ row.position }}</span>
                      </td>
                      <td>
                        <div class="driver-cell">
                          <span class="driver-face" [style.--driver-color]="row.color">
                            <img
                              [src]="row.driver.headshot_url"
                              [alt]="row.driver.full_name"
                              loading="lazy"
                              decoding="async"
                              (error)="hideImage($event)"
                            />
                            <span class="driver-face__monogram">{{ row.driver.name_acronym }}</span>
                          </span>
                          <span class="driver-cell__copy">
                            <strong>{{ row.driver.first_name }} {{ row.driver.last_name }}</strong>
                            <small>
                              <span class="team-dot" [style.background]="row.color"></span>
                              {{ row.driver.team_name }}
                            </small>
                          </span>
                          <span class="driver-number tabular" [style.color]="row.color">#{{ row.driver.driver_number }}</span>
                        </div>
                      </td>
                      <td class="t-num tabular">{{ gapLabel(row) }}</td>
                      <td class="t-num tabular dim">{{ intervalLabel(row) }}</td>
                      <td class="t-num tabular">{{ row.laps }}</td>
                      <td class="t-num tabular">{{ formatLap(row.lastLap) }}</td>
                      <td class="t-num tabular" [class.is-best]="row.bestLap !== null && row.bestLap === sessionBest()">
                        {{ formatLap(row.bestLap) }}
                      </td>
                      <td>
                        @if (row.stint; as stint) {
                          <span class="tyre" [style.--tyre-color]="compoundColor(stint.compound)">
                            <span class="tyre__ring">{{ compoundLetter(stint.compound) }}</span>
                            <span class="tyre__age">{{ stint.lap_end - stint.lap_start + 1 }}L</span>
                          </span>
                        } @else {
                          <span class="dim">—</span>
                        }
                      </td>
                      <td class="t-num tabular dim">{{ row.pitStops }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-panel>

          <!-- ------------------------------------------------------------- side -->
          <div class="side">
            @if (b.weather; as weather) {
              <app-panel class="weather-card">
                <div class="card-head">
                  <div>
                    <span class="eyebrow">Conditions</span>
                    <h2>Weather</h2>
                  </div>
                  <span class="weather-card__icon" aria-hidden="true">{{ weather.rainfall ? '🌧️' : '☀️' }}</span>
                </div>

                <div class="weather-grid">
                  <span><small>Air</small><strong>{{ weather.air_temperature | number: '1.1-1' }}°</strong></span>
                  <span><small>Track</small><strong>{{ weather.track_temperature | number: '1.1-1' }}°</strong></span>
                  <span><small>Humidity</small><strong>{{ weather.humidity | number: '1.0-0' }}%</strong></span>
                  <span><small>Wind</small><strong>{{ weather.wind_speed | number: '1.1-1' }} m/s</strong></span>
                  <span><small>Rainfall</small><strong>{{ weather.rainfall ? 'Yes' : 'No' }}</strong></span>
                  <span><small>Pressure</small><strong>{{ weather.pressure | number: '1.0-0' }} hPa</strong></span>
                </div>
                <span class="weather-card__stamp dim">Sample {{ weather.date | date: 'HH:mm:ss' }}</span>
              </app-panel>
            }

            <app-panel class="rc-card">
              <div class="card-head">
                <div>
                  <span class="eyebrow">Race control</span>
                  <h2>Latest messages</h2>
                </div>
                <span class="pill">{{ b.raceControl.length }}</span>
              </div>

              @if (b.raceControl.length) {
                <ol class="rc-list">
                  @for (message of b.raceControl; track message.date + message.message) {
                    <li class="rc-item" [style.--rc-color]="flagColor(message)">
                      <span class="rc-item__dot" aria-hidden="true"></span>
                      <span class="rc-item__copy">
                        <span class="rc-item__head">
                          <strong>{{ message.category }}</strong>
                          @if (message.lap_number) {
                            <span class="dim">Lap {{ message.lap_number }}</span>
                          }
                          <span class="dim">{{ message.date | date: 'HH:mm:ss' }}</span>
                        </span>
                        <span class="rc-item__message">{{ message.message }}</span>
                      </span>
                    </li>
                  }
                </ol>
              } @else {
                <p class="dim rc-empty">No race-control messages for this session.</p>
              }
            </app-panel>
          </div>
        </div>

        <!-- ---------------------------------------------------------- telemetry -->
        <app-panel class="telemetry-card">
          <div class="card-head">
            <div>
              <span class="eyebrow">Car telemetry</span>
              <h2>Lap trace</h2>
            </div>
            <span class="pill">Speed · gear · DRS</span>
          </div>

          <p class="telemetry-card__lede muted">
            Telemetry is fetched windowed per driver and lap — never a whole session — to stay inside OpenF1's rate
            limit.
          </p>

          <div class="telemetry-controls">
            <div class="field">
              <select [value]="telemetryDriver() ?? ''" (change)="onTelemetryDriver($event)" aria-label="Driver">
                <option value="">Select driver</option>
                @for (row of b.rows; track row.driver.driver_number) {
                  <option [value]="row.driver.driver_number">
                    #{{ row.driver.driver_number }} {{ row.driver.full_name }}
                  </option>
                }
              </select>
            </div>

            <div class="field">
              <select [value]="telemetryLap() ?? ''" (change)="onTelemetryLap($event)" aria-label="Lap">
                <option value="">Select lap</option>
                @for (lap of driverLaps(); track lap.lap_number) {
                  <option [value]="lap.lap_number">Lap {{ lap.lap_number }} · {{ formatLap(lap.lap_duration) }}</option>
                }
              </select>
            </div>

            <button
              type="button"
              class="btn btn--primary btn--sm"
              [disabled]="!telemetryDriver() || !telemetryLap() || telemetryLoading()"
              (click)="loadTelemetry()"
            >
              {{ telemetryLoading() ? 'Loading…' : 'Load lap' }}
            </button>
          </div>

          @if (telemetryLoading()) {
            <app-skeleton-loader [count]="1" [height]="220" />
          } @else if (telemetry().length) {
            <app-telemetry-chart [car]="telemetry()" [accent]="telemetryAccent()" />
            <span class="telemetry-card__stamp dim">
              {{ telemetry().length }} samples · {{ telemetryFromLabel() }}
            </span>
          } @else {
            <div class="telemetry-card__empty">
              <span aria-hidden="true">📈</span>
              <p>Pick a driver and a lap to trace their speed, gears and DRS through the lap.</p>
            </div>
          }
        </app-panel>
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

      /* -------------------------------------------------------------- picker */
      .picker {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 0.9rem 1rem;
        border-radius: var(--r-lg);
        margin-bottom: 1.25rem;
      }

      .picker__row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .picker__meeting {
        flex: 0 1 340px;
        background: var(--surface-2);
      }

      .picker__meeting select {
        font-size: 0.82rem;
        font-weight: 600;
      }

      .picker__meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.76rem;
      }

      .picker__flag {
        font-size: 1.1rem;
      }

      .picker__where {
        font-weight: 600;
      }

      .session-strip {
        display: flex;
        gap: 0.4rem;
        overflow-x: auto;
        padding-bottom: 0.2rem;
        scrollbar-width: thin;
      }

      .session-chip {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        padding: 0.5rem 0.85rem;
        border-radius: var(--r-sm);
        border: 1px solid var(--border);
        background: var(--surface-2);
        text-align: left;
        transition:
          border-color var(--dur-fast) var(--ease),
          background var(--dur-fast) var(--ease);
      }

      .session-chip:hover {
        border-color: var(--border-strong);
      }

      .session-chip.is-active {
        border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
        background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
        box-shadow: 0 0 0 3px var(--accent-soft);
      }

      .session-chip__name {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text);
      }

      .session-chip__date {
        font-size: 0.62rem;
        color: var(--text-3);
        font-variant-numeric: tabular-nums;
      }

      .token-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--text-3);
      }

      .token-dot.is-on {
        background: #45d18b;
        box-shadow: 0 0 8px #45d18b;
      }

      .btn.is-on {
        border-color: color-mix(in srgb, #45d18b 45%, var(--border));
      }

      .token-panel {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 0.85rem 1rem;
        border-radius: var(--r-sm);
        background: var(--surface-2);
        border: 1px dashed var(--border);
      }

      .token-panel p {
        font-size: 0.74rem;
        line-height: 1.5;
        color: var(--text-2);
        max-width: 90ch;
      }

      .token-panel code {
        font-size: 0.72rem;
        color: var(--text);
      }

      .token-panel__row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .token-panel__input {
        flex: 1 1 260px;
        background: var(--bg-2);
      }

      .token-panel__status {
        font-size: 0.72rem;
        color: #45d18b;
      }

      /* ------------------------------------------------------------- banner */
      .session-banner {
        position: relative;
        padding: 1.1rem 1.35rem;
        border-radius: var(--r-lg);
        border-top: 2px solid var(--session-color, var(--border));
        overflow: hidden;
        margin-bottom: 1.25rem;
      }

      .session-banner__main {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .session-banner__title {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .session-banner__title h2 {
        font-size: clamp(1.3rem, 2.8vw, 1.9rem);
        letter-spacing: -0.03em;
      }

      .session-banner__title p {
        font-size: 0.8rem;
      }

      .session-banner__actions {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 10px var(--accent);
        animation: pulseGlow 2.2s ease-in-out infinite;
      }

      .pill--live {
        color: var(--text);
        border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1.25rem;
      }

      .board {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(290px, 0.34fr);
        gap: 1.25rem;
        align-items: start;
      }

      .card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.1rem 1.25rem 0.9rem;
      }

      .card-head h2 {
        font-size: 1.1rem;
        margin-top: 0.15rem;
      }

      .timing-card,
      .weather-card,
      .rc-card,
      .telemetry-card {
        overflow: hidden;
      }

      .timing-scroll {
        overflow-x: auto;
      }

      .timing-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
        min-width: 760px;
      }

      .timing-table th {
        padding: 0.55rem 0.75rem;
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

      .timing-table td {
        padding: 0.45rem 0.75rem;
        border-bottom: 1px solid var(--divider);
        vertical-align: middle;
      }

      .timing-table tbody tr:hover {
        background: var(--surface-2);
      }

      .timing-table tr.is-leader {
        background: color-mix(in srgb, var(--accent) 6%, transparent);
      }

      .timing-table tr.is-pit {
        background: color-mix(in srgb, #64c4ff 8%, transparent);
      }

      .t-pos {
        width: 2.6rem;
      }

      .t-num {
        text-align: right;
        white-space: nowrap;
      }

      .pos {
        display: inline-grid;
        place-items: center;
        min-width: 1.5rem;
        height: 1.5rem;
        border-radius: 6px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-family: var(--font-display);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .pos--podium {
        border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
        color: var(--accent);
      }

      .driver-cell {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        min-width: 0;
      }

      .driver-face {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--surface-3);
        border: 2px solid var(--driver-color, var(--border));
      }

      .driver-face img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        z-index: 1;
      }

      .driver-face__monogram {
        font-family: var(--font-display);
        font-size: 0.62rem;
        font-weight: 700;
        color: var(--text-2);
      }

      .driver-cell__copy {
        display: flex;
        flex-direction: column;
        gap: 0.05rem;
        min-width: 0;
      }

      .driver-cell__copy strong {
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
      }

      .driver-cell__copy small {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.62rem;
        color: var(--text-3);
        white-space: nowrap;
      }

      .team-dot {
        width: 5px;
        height: 5px;
        border-radius: 2px;
      }

      .driver-number {
        margin-left: auto;
        font-size: 0.62rem;
        font-weight: 700;
        opacity: 0.7;
      }

      .is-best {
        color: #c89bff;
        font-weight: 700;
      }

      .tyre {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .tyre__ring {
        display: inline-grid;
        place-items: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid var(--tyre-color, #8b8f98);
        font-size: 0.55rem;
        font-weight: 700;
        color: var(--tyre-color, var(--text-2));
      }

      .tyre__age {
        font-size: 0.62rem;
        color: var(--text-3);
        font-variant-numeric: tabular-nums;
      }

      /* ---------------------------------------------------------------- side */
      .side {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        position: sticky;
        top: calc(var(--nav-h) + 1rem);
      }

      .weather-card__icon {
        font-size: 1.4rem;
      }

      .weather-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.7rem;
        padding: 0 1.25rem 1rem;
      }

      .weather-grid span {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .weather-grid small {
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-3);
      }

      .weather-grid strong {
        font-size: 0.88rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      .weather-card__stamp {
        display: block;
        padding: 0 1.25rem 1rem;
        font-size: 0.64rem;
      }

      .rc-list {
        display: flex;
        flex-direction: column;
        max-height: 420px;
        overflow-y: auto;
        scrollbar-width: thin;
      }

      .rc-item {
        display: flex;
        gap: 0.6rem;
        padding: 0.55rem 1.25rem;
        border-top: 1px solid var(--divider);
      }

      .rc-item__dot {
        flex: 0 0 auto;
        width: 6px;
        height: 6px;
        margin-top: 0.4rem;
        border-radius: 999px;
        background: var(--rc-color, var(--text-3));
        box-shadow: 0 0 8px color-mix(in srgb, var(--rc-color, transparent) 60%, transparent);
      }

      .rc-item__copy {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }

      .rc-item__head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        font-size: 0.62rem;
        color: var(--text-3);
      }

      .rc-item__head strong {
        color: var(--text-2);
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .rc-item__message {
        font-size: 0.74rem;
        line-height: 1.4;
        color: var(--text-2);
      }

      .rc-empty {
        padding: 0 1.25rem 1.25rem;
        font-size: 0.78rem;
      }

      /* ----------------------------------------------------------- telemetry */
      .telemetry-card {
        margin-top: 1.25rem;
        padding-bottom: 1.25rem;
      }

      .telemetry-card__lede {
        padding: 0 1.25rem;
        font-size: 0.78rem;
        max-width: 90ch;
      }

      .telemetry-controls {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding: 0.9rem 1.25rem 1.1rem;
      }

      .telemetry-controls .field {
        flex: 0 1 250px;
        padding: 0.45rem 0.85rem;
      }

      .telemetry-controls select {
        font-size: 0.8rem;
      }

      .telemetry-card app-telemetry-chart {
        display: block;
        padding: 0 1.25rem;
      }

      .telemetry-card__stamp {
        display: block;
        padding: 0.6rem 1.25rem 0;
        font-size: 0.66rem;
      }

      .telemetry-card__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin: 0 1.25rem;
        padding: 2rem 1rem;
        border-radius: var(--r-md);
        border: 1px dashed var(--border);
        text-align: center;
        color: var(--text-3);
      }

      .telemetry-card__empty span {
        font-size: 1.5rem;
      }

      .telemetry-card__empty p {
        font-size: 0.8rem;
        max-width: 46ch;
      }

      .board-loading {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      @media (max-width: 1120px) {
        .board {
          grid-template-columns: 1fr;
        }

        .side {
          position: static;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .stat-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .side {
          grid-template-columns: 1fr;
        }

        .stat-grid {
          grid-template-columns: 1fr;
        }

        .picker__meeting {
          flex-basis: 100%;
        }

        .weather-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class LiveComponent implements OnInit {
  private readonly openf1 = inject(OpenF1Service);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly years = Array.from(
    { length: CURRENT_YEAR - OPENF1_START_YEAR + 1 },
    (_, i) => CURRENT_YEAR - i,
  );

  readonly year = signal(CURRENT_YEAR);
  readonly meetings = signal<OpenF1Meeting[]>([]);
  readonly sessions = signal<OpenF1Session[]>([]);
  readonly meetingKey = signal<number | null>(null);
  readonly sessionKey = signal<number | null>(null);
  readonly session = signal<OpenF1Session | null>(null);

  readonly loadingSessions = signal(true);
  readonly loadingBoard = signal(false);
  readonly boardError = signal(false);
  readonly board = signal<LiveBoard | null>(null);

  readonly hasToken = signal(this.openf1.hasToken);
  readonly tokenPanel = signal(false);
  readonly tokenInput = signal('');
  readonly tokenSaved = signal(false);
  readonly polling = signal(false);

  readonly telemetryDriver = signal<number | null>(null);
  readonly telemetryLap = signal<number | null>(null);
  readonly telemetry = signal<OpenF1CarData[]>([]);
  readonly telemetryLoading = signal(false);
  readonly telemetryFrom = signal<OpenF1Lap | null>(null);

  private pollSub: Subscription | null = null;
  private initialised = false;

  readonly selectedMeeting = computed(
    () => this.meetings().find((meeting) => meeting.meeting_key === this.meetingKey()) ?? null,
  );

  readonly meetingSessions = computed(() =>
    this.sessions()
      .filter((session) => session.meeting_key === this.meetingKey())
      .slice()
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()),
  );

  readonly leaderLaps = computed(() => this.board()?.rows[0]?.laps ?? 0);

  readonly sessionBest = computed(() => {
    const laps = this.board()?.rows.map((row) => row.bestLap).filter((lap): lap is number => lap !== null) ?? [];
    return laps.length ? Math.min(...laps) : null;
  });

  readonly sessionColor = computed(() => this.board()?.rows[0]?.color ?? '#e10600');

  readonly trackTempLabel = computed(() => {
    const track = this.board()?.weather?.track_temperature;
    return track === null || track === undefined ? '—' : `${track.toFixed(1)}°`;
  });

  readonly weatherHint = computed(() => {
    const weather = this.board()?.weather;
    if (!weather) return 'No weather sample';
    const air = weather.air_temperature;
    const airLabel = air === null || air === undefined ? '—' : `${Math.round(air)}°`;
    return `Air ${airLabel} · ${weather.rainfall ? 'Wet' : 'Dry'}`;
  });

  readonly isLive = computed(() => {
    const session = this.session();
    if (!session) return false;
    const start = new Date(session.date_start).getTime();
    const end = new Date(session.date_end).getTime();
    const now = Date.now();
    return now >= start - 20 * 60_000 && now <= end + 20 * 60_000;
  });

  readonly driverLaps = computed(() => {
    const number = this.telemetryDriver();
    const laps = this.board()?.laps ?? [];
    if (!number) return [];
    return laps
      .filter((lap) => lap.driver_number === number && lap.lap_duration !== null)
      .slice()
      .sort((a, b) => a.lap_number - b.lap_number);
  });

  readonly telemetryAccent = computed(() => {
    const number = this.telemetryDriver();
    return this.board()?.rows.find((row) => row.driver.driver_number === number)?.color ?? '#ff2d20';
  });

  readonly telemetryFromLabel = computed(() => {
    const lap = this.telemetryFrom();
    const row = this.board()?.rows.find((entry) => entry.driver.driver_number === this.telemetryDriver());
    if (!lap || !row) return '';
    return `${row.driver.full_name} · lap ${lap.lap_number}`;
  });

  readonly flagFor = (country: string): string => countryFlag(country);

  private readonly pollingStorageKey = 'paddock.openf1.polling';

  constructor() {
    this.polling.set(this.readPollingPreference());

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const sessionKey = Number(params.get('session'));
      const year = Number(params.get('year'));

      if (!this.initialised) {
        this.initialised = true;
        this.bootstrap(Number.isFinite(sessionKey) ? sessionKey : 0, Number.isFinite(year) ? year : 0);
        return;
      }

      if (Number.isFinite(sessionKey) && sessionKey && sessionKey !== this.sessionKey()) {
        this.bootstrap(sessionKey, Number.isFinite(year) ? year : 0);
      } else if (!sessionKey && Number.isFinite(year) && year && year !== this.year()) {
        this.loadYear(year);
      }
    });
  }

  ngOnInit(): void {
    // Handled by the query-param subscription.
  }

  canStep(direction: 1 | -1): boolean {
    const index = this.years.indexOf(this.year());
    const next = index + direction;
    return next >= 0 && next < this.years.length;
  }

  stepYear(direction: 1 | -1): void {
    const index = this.years.indexOf(this.year());
    const next = this.years[index + direction];
    if (next) this.loadYear(next);
  }

  onYearChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value) && value !== this.year()) this.loadYear(value);
  }

  onMeetingChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value)) return;
    this.meetingKey.set(value);
    const weekend = this.sessions()
      .filter((session) => session.meeting_key === value)
      .slice()
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    const target = weekend[weekend.length - 1];
    if (target) this.selectSession(target);
  }

  selectSession(session: OpenF1Session): void {
    this.sessionKey.set(session.session_key);
    this.session.set(session);
    this.meetingKey.set(session.meeting_key);
    this.syncUrl(session.year, session.session_key);
    this.loadBoard(session.session_key);
  }

  refresh(): void {
    const key = this.sessionKey();
    if (!key) return;
    this.openf1.clearSessionCache(key);
    this.loadBoard(key, true);
  }

  togglePolling(): void {
    this.polling.set(!this.polling());
    try {
      localStorage.setItem(this.pollingStorageKey, this.polling() ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
    this.syncPolling();
  }

  onTokenInput(event: Event): void {
    this.tokenInput.set((event.target as HTMLInputElement).value);
    this.tokenSaved.set(false);
  }

  saveToken(): void {
    const value = this.tokenInput().trim();
    if (!value) return;
    this.openf1.setToken(value);
    this.hasToken.set(this.openf1.hasToken);
    this.tokenSaved.set(true);
    this.tokenInput.set('');
    this.polling.set(true);
    this.syncPolling();
    this.refresh();
  }

  clearToken(): void {
    this.openf1.setToken(null);
    this.hasToken.set(false);
    this.tokenInput.set('');
    this.tokenSaved.set(false);
    this.polling.set(false);
    this.syncPolling();
  }

  onTelemetryDriver(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.telemetryDriver.set(Number.isFinite(value) && value ? value : null);
    this.telemetryLap.set(null);
    this.telemetry.set([]);
    this.telemetryFrom.set(null);

    const laps = this.driverLaps();
    if (laps.length) {
      const best = laps.reduce((fastest, lap) =>
        (lap.lap_duration ?? Infinity) < (fastest.lap_duration ?? Infinity) ? lap : fastest,
      );
      this.telemetryLap.set(best.lap_number);
    }
  }

  onTelemetryLap(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.telemetryLap.set(Number.isFinite(value) && value ? value : null);
    this.telemetry.set([]);
    this.telemetryFrom.set(null);
  }

  loadTelemetry(): void {
    const key = this.sessionKey();
    const driver = this.telemetryDriver();
    const lapNumber = this.telemetryLap();
    if (!key || !driver || !lapNumber) return;

    const laps = this.driverLaps();
    const lap = laps.find((entry) => entry.lap_number === lapNumber);
    if (!lap) return;

    const next = laps.find((entry) => entry.lap_number === lapNumber + 1);
    const from = lap.date_start;
    const to = next?.date_start ?? new Date(new Date(from).getTime() + 180_000).toISOString();

    this.telemetryLoading.set(true);
    this.telemetryFrom.set(lap);
    this.openf1.getCarData(key, driver, from, to).subscribe({
      next: (rows) => {
        this.telemetry.set(rows);
        this.telemetryLoading.set(false);
      },
      error: () => {
        this.telemetry.set([]);
        this.telemetryLoading.set(false);
      },
    });
  }

  formatLap(seconds: number | null | undefined): string {
    return formatLapTime(seconds);
  }

  gapLabel(row: LiveDriverRow): string {
    if (row.position === 1) return 'Leader';
    return this.gapValue(row.gap);
  }

  intervalLabel(row: LiveDriverRow): string {
    if (row.position === 1) return '—';
    return this.gapValue(row.interval);
  }

  compoundLetter(compound: string): string {
    const value = compound.toUpperCase();
    if (value.startsWith('SOFT')) return 'S';
    if (value.startsWith('MEDIUM')) return 'M';
    if (value.startsWith('HARD')) return 'H';
    if (value.startsWith('INTER')) return 'I';
    if (value.startsWith('WET')) return 'W';
    return value.slice(0, 1) || '?';
  }

  compoundColor(compound: string): string {
    const value = compound.toUpperCase();
    if (value.startsWith('SOFT')) return '#ff4b3e';
    if (value.startsWith('MEDIUM')) return '#f2c14e';
    if (value.startsWith('HARD')) return '#d7dbe2';
    if (value.startsWith('INTER')) return '#45d18b';
    if (value.startsWith('WET')) return '#64c4ff';
    return '#8b8f98';
  }

  flagColor(message: OpenF1RaceControl): string {
    switch ((message.flag ?? '').toUpperCase()) {
      case 'RED':
        return '#ff4b3e';
      case 'YELLOW':
      case 'DOUBLE YELLOW':
        return '#f2c14e';
      case 'GREEN':
        return '#45d18b';
      case 'BLUE':
        return '#64c4ff';
      case 'CHEQUERED':
        return '#ffffff';
      default:
        return message.category === 'SafetyCar' ? '#f2c14e' : 'var(--text-3)';
    }
  }

  hideImage(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  private bootstrap(sessionKey: number, year: number): void {
    if (sessionKey) {
      this.openf1
        .getSession(sessionKey)
        .pipe(catchError(() => of([])))
        .subscribe((sessions) => {
          const session = sessions[0];
          if (session) this.loadYear(session.year, session.session_key);
          else this.loadYear(year || CURRENT_YEAR);
        });
      return;
    }
    this.loadYear(year || CURRENT_YEAR);
  }

  private loadYear(year: number, preferSessionKey?: number): void {
    this.loadingSessions.set(true);
    this.boardError.set(false);

    forkJoin({
      meetings: this.openf1.getMeetings(year).pipe(catchError(() => of([] as OpenF1Meeting[]))),
      sessions: this.openf1.getSessions(year).pipe(catchError(() => of([] as OpenF1Session[]))),
    }).subscribe(({ meetings, sessions }) => {
      const liveSessions = sessions
        .filter((session) => !session.is_cancelled)
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());

      if (!liveSessions.length && year > OPENF1_START_YEAR) {
        this.loadYear(year - 1, preferSessionKey);
        return;
      }

      this.year.set(year);
      this.meetings.set(meetings.filter((meeting) => !meeting.is_cancelled));
      this.sessions.set(liveSessions);
      this.loadingSessions.set(false);

      const preferred = preferSessionKey
        ? liveSessions.find((session) => session.session_key === preferSessionKey)
        : undefined;
      const target = preferred ?? liveSessions[liveSessions.length - 1];
      if (target) {
        this.sessionKey.set(target.session_key);
        this.session.set(target);
        this.meetingKey.set(target.meeting_key);
        this.syncUrl(year, target.session_key);
        this.loadBoard(target.session_key);
      } else {
        this.sessionKey.set(null);
        this.session.set(null);
        this.board.set(null);
        this.meetingKey.set(meetings[0]?.meeting_key ?? null);
      }
    });
  }

  private loadBoard(sessionKey: number, silent = false): void {
    if (!silent) this.loadingBoard.set(true);
    this.boardError.set(false);

    this.openf1.getLiveBoard(sessionKey).subscribe({
      next: (board) => {
        this.board.set(board as LiveBoard);
        this.loadingBoard.set(false);
        this.resetTelemetrySelection();
        this.syncPolling();
      },
      error: () => {
        this.boardError.set(true);
        this.loadingBoard.set(false);
        this.stopPolling();
      },
    });
  }

  private resetTelemetrySelection(): void {
    const board = this.board();
    if (!board?.rows.length) return;
    const current = this.telemetryDriver();
    if (current && board.rows.some((row) => row.driver.driver_number === current)) return;

    this.telemetryDriver.set(null);
    this.telemetryLap.set(null);
    this.telemetry.set([]);
    this.telemetryFrom.set(null);
  }

  private syncPolling(): void {
    this.stopPolling();
    if (!this.hasToken() || !this.polling() || !this.sessionKey()) return;

    this.pollSub = interval(15_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private readPollingPreference(): boolean {
    try {
      return localStorage.getItem(this.pollingStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private syncUrl(year: number, sessionKey: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year, session: sessionKey },
      replaceUrl: true,
    });
  }

  private gapValue(value: number | string | null): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
      if (value === 0) return '+0.000';
      return `+${value.toFixed(3)}`;
    }
    return value;
  }
}
