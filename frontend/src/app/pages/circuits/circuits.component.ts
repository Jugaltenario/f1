import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CircuitCareer } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { ARCHIVE_END_YEAR } from '../../core/config/data.config';
import { CIRCUIT_MAPS } from '../../core/config/asset-manifest';
import { countryFlag, countryCode } from '../../core/utils/country';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

type CircuitSort = 'races' | 'name' | 'recent' | 'oldest';

interface MapPoint {
  circuit: CircuitCareer;
  x: number;
  y: number;
  active: boolean;
}

@Component({
  selector: 'app-circuits',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page circuits-page">
      <app-page-header
        eyebrow="Venues · 2000 → {{ archiveEnd }}"
        title="Circuits"
        subtitle="From Monaco's streets to Suzuka's esses — every venue that has hosted a world championship round since 2000."
      >
        <span class="pill">{{ circuits().length }} venues</span>
        <span class="pill">{{ countryCount() }} countries</span>
      </app-page-header>

      @if (loading()) {
        <app-skeleton-loader [count]="5" [height]="120" />
      } @else {
        <section class="explorer">
          <!-- ------------------------------------------------------------- map -->
          <app-panel class="map-panel">
            <div class="panel-head">
              <div>
                <span class="eyebrow">Global grid</span>
                <h2>Where the circus goes</h2>
              </div>
              <span class="pill">{{ mapped().length }} plotted</span>
            </div>

            <svg viewBox="0 0 640 290" class="map" role="img" aria-label="World map of circuits">
              <defs>
                <pattern id="mapDots" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="var(--silver-3)" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="640" height="290" fill="url(#mapDots)" rx="12" />

              <line class="equator" x1="0" y1="132" x2="640" y2="132" />
              <text class="map-label" x="8" y="126">equator</text>

              @for (point of mapped(); track point.circuit.circuitId) {
                <g
                  class="map-point"
                  role="button"
                  tabindex="0"
                  [attr.aria-label]="point.circuit.name"
                  (click)="select(point.circuit)"
                  (keydown.enter)="select(point.circuit)"
                >
                  <circle
                    [attr.cx]="point.x"
                    [attr.cy]="point.y"
                    [attr.r]="point.active ? 8 : 5"
                    [attr.fill]="point.circuit.color"
                    [attr.opacity]="point.active ? 0.32 : 0.16"
                  />
                  <circle
                    [attr.cx]="point.x"
                    [attr.cy]="point.y"
                    [attr.r]="point.active ? 3.6 : 2.4"
                    [attr.fill]="point.circuit.color"
                  />
                  @if (point.active) {
                    <circle
                      class="map-point__ring"
                      [attr.cx]="point.x"
                      [attr.cy]="point.y"
                      r="10"
                      fill="none"
                      [attr.stroke]="point.circuit.color"
                    />
                  }
                  <title>{{ point.circuit.name }} · {{ point.circuit.location }}</title>
                </g>
              }
            </svg>

            <div class="map__footer">
              <span class="muted">Equirectangular projection · dot size = races hosted</span>
              @if (selected(); as circuit) {
                <button type="button" class="btn btn--ghost btn--sm" (click)="selected.set(null)">Clear selection</button>
              }
            </div>
          </app-panel>

          <!-- ---------------------------------------------------------- detail -->
          <app-panel class="detail-panel" [variant]="selected() ? 'accent' : 'default'" [accent]="selected()?.color ?? '#e10600'">
            @if (selected(); as circuit) {
              <div class="detail">
                <div class="detail__hero">
                  @if (mapFor(circuit); as map) {
                    <img
                      class="detail__map"
                      [src]="map"
                      [alt]="circuit.name + ' circuit layout'"
                      loading="lazy"
                      (error)="onMapError(circuit)"
                    />
                  } @else {
                    <span class="detail__flag">{{ flag(circuit.country) }}</span>
                  }
                  <span class="detail__code">{{ code(circuit.country) }}</span>
                </div>

                <div class="detail__body">
                  <span class="eyebrow">{{ circuit.location }}, {{ circuit.country }}</span>
                  <h2>{{ circuit.name }}</h2>

                  <div class="detail__facts">
                    <span><strong>{{ circuit.races }}</strong> races</span>
                    <span><strong>{{ circuit.firstYear }}</strong> debut</span>
                    <span><strong>{{ circuit.lastYear }}</strong> latest</span>
                    <span><strong>{{ circuit.alt }}</strong> m altitude</span>
                  </div>

                  <div class="detail__coords">
                    <span class="tabular">{{ circuit.lat?.toFixed(3) }}, {{ circuit.lng?.toFixed(3) }}</span>
                    <span class="dim">{{ circuit.circuitRef }}</span>
                  </div>

                  <div class="detail__actions">
                    <a class="btn btn--primary btn--sm" routerLink="/races" [queryParams]="{ circuit: circuit.circuitRef }">
                      Races at this circuit
                    </a>
                    <a class="btn btn--sm" routerLink="/standings">Season archive</a>
                  </div>
                </div>
              </div>
            } @else {
              <div class="detail detail--empty">
                <span class="detail__empty-icon" aria-hidden="true">🗺️</span>
                <h2>Pick a circuit</h2>
                <p class="muted">Tap a dot on the map or any card below to see its record in the archive.</p>
              </div>
            }
          </app-panel>
        </section>

        <!-- ------------------------------------------------------------- toolbar -->
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
              placeholder="Search circuits, cities or countries…"
              aria-label="Search circuits"
            />
          </label>

          <div class="field toolbar__select">
            <select [value]="sort()" (change)="onSort($event)" aria-label="Sort circuits">
              <option value="races">Most races</option>
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </section>

        @if (!filtered().length) {
          <app-empty-state
            icon="🔍"
            title="No circuits match that search"
            message="Try a country, a city or part of the circuit name."
            actionLabel="Back to all circuits"
            actionLink="/circuits"
          />
        } @else {
          <div class="circuit-grid">
            @for (circuit of filtered(); track circuit.circuitId) {
              <button type="button" class="circuit-card-button" (click)="select(circuit)">
                <app-panel variant="default" [interactive]="true" [accent]="circuit.color">
                  <article class="circuit-tile" [class.is-selected]="selected()?.circuitId === circuit.circuitId">
                    <div class="circuit-tile__hero">
                      @if (mapFor(circuit); as map) {
                        <img
                          class="circuit-tile__map"
                          [src]="map"
                          [alt]="circuit.name + ' layout'"
                          loading="lazy"
                          (error)="onMapError(circuit)"
                        />
                      } @else {
                        <span class="circuit-tile__flag" aria-hidden="true">{{ flag(circuit.country) }}</span>
                      }
                      <span class="circuit-tile__country">{{ code(circuit.country) }}</span>
                      <span class="circuit-tile__races">{{ circuit.races }} races</span>
                    </div>

                    <div class="circuit-tile__body">
                      <h3>{{ circuit.name }}</h3>
                      <span class="circuit-tile__location">{{ circuit.location }}, {{ circuit.country }}</span>

                      <div class="circuit-tile__stats">
                        <span><strong class="tabular">{{ circuit.firstYear }}</strong> first</span>
                        <span><strong class="tabular">{{ circuit.lastYear }}</strong> latest</span>
                        <span><strong class="tabular">{{ circuit.alt }}</strong> m</span>
                      </div>
                    </div>
                  </article>
                </app-panel>
              </button>
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

      .explorer {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 1.25rem;
        margin-bottom: 1.5rem;
        align-items: stretch;
      }

      .map-panel {
        padding: 1.4rem;
      }

      .panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.85rem;
      }

      .panel-head h2 {
        font-size: 1.25rem;
        margin-top: 0.15rem;
      }

      .map {
        width: 100%;
        height: auto;
        border-radius: var(--r-sm);
        overflow: hidden;
      }

      .equator {
        stroke: var(--divider);
        stroke-width: 1;
        stroke-dasharray: 4 6;
      }

      .map-label {
        fill: var(--text-3);
        font-size: 9px;
        font-family: var(--font-ui);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .map-point {
        cursor: pointer;
        outline: none;
      }

      .map-point circle {
        transition:
          r var(--dur-fast) var(--ease-out),
          opacity var(--dur-fast) var(--ease);
      }

      .map-point:hover circle,
      .map-point:focus-visible circle {
        opacity: 1;
      }

      .map-point__ring {
        stroke-width: 1.2;
        opacity: 0.7;
      }

      .map__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 0.5rem;
        font-size: 0.68rem;
      }

      .detail-panel {
        overflow: hidden;
      }

      .detail {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .detail__hero {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 150px;
        padding: 0.75rem;
        background: var(--surface-2);
        border-bottom: 1px solid var(--divider);
        overflow: hidden;
      }

      .detail__map {
        width: 100%;
        max-width: 280px;
        max-height: 118px;
        object-fit: contain;
        filter: grayscale(1) contrast(1.05);
        opacity: 0.72;
      }

      .detail__flag {
        font-size: clamp(3.5rem, 8vw, 5.5rem);
        line-height: 1;
      }

      .detail__code {
        position: absolute;
        right: 1rem;
        bottom: 0.75rem;
        font-family: var(--font-display);
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-4);
        letter-spacing: 0.16em;
      }

      .detail__body {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 1.25rem;
      }

      .detail__body h2 {
        font-size: clamp(1.3rem, 2.6vw, 1.7rem);
        letter-spacing: -0.03em;
      }

      .detail__facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
        margin-top: 0.35rem;
      }

      .detail__facts span {
        padding: 0.5rem 0.65rem;
        border-radius: var(--r-xs);
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 0.68rem;
        color: var(--text-3);
      }

      .detail__facts strong {
        display: block;
        font-size: 1rem;
        color: var(--text);
        font-weight: 700;
      }

      .detail__coords {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.7rem;
        color: var(--text-2);
      }

      .detail__actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-top: 0.4rem;
      }

      .detail--empty {
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 2.5rem 1.5rem;
        text-align: center;
      }

      .detail__empty-icon {
        display: grid;
        place-items: center;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 1.5rem;
      }

      .detail--empty h2 {
        font-size: 1.1rem;
      }

      .detail--empty p {
        font-size: 0.82rem;
        max-width: 34ch;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding: 0.6rem;
        border-radius: 999px;
        margin-bottom: 1rem;
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

      .circuit-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 1rem;
      }

      .circuit-card-button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0;
        color: var(--text);
      }

      .circuit-card-button app-panel {
        display: block;
        height: 100%;
      }

      .circuit-tile {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .circuit-tile__hero {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 104px;
        padding: 0.75rem 2.4rem;
        background: var(--surface-2);
        border-bottom: 1px solid var(--divider);
        overflow: hidden;
      }

      .circuit-tile__map {
        width: 100%;
        max-width: 190px;
        max-height: 68px;
        object-fit: contain;
        filter: grayscale(1) contrast(1.05);
        opacity: 0.7;
        transition: opacity var(--dur-fast) var(--ease);
      }

      .circuit-card-button:hover .circuit-tile__map,
      .circuit-tile.is-selected .circuit-tile__map {
        opacity: 0.95;
      }

      .circuit-tile__flag {
        font-size: 2.4rem;
        line-height: 1;
      }

      .circuit-tile__country {
        position: absolute;
        left: 0.75rem;
        top: 0.65rem;
        font-family: var(--font-display);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: var(--text-4);
      }

      .circuit-tile__races {
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

      .circuit-tile__body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.9rem 1rem 1rem;
        flex: 1;
      }

      .circuit-tile__body h3 {
        font-size: 0.98rem;
        letter-spacing: -0.02em;
      }

      .circuit-tile__location {
        font-size: 0.7rem;
        color: var(--text-3);
      }

      .circuit-tile__stats {
        display: flex;
        gap: 0.9rem;
        margin-top: auto;
        padding-top: 0.7rem;
        font-size: 0.62rem;
        color: var(--text-3);
      }

      .circuit-tile__stats strong {
        display: block;
        font-size: 0.82rem;
        color: var(--text);
      }

      .circuit-tile.is-selected {
        outline: 1px solid color-mix(in srgb, var(--circuit-color) 55%, transparent);
        outline-offset: -4px;
      }

      @media (max-width: 1080px) {
        .explorer {
          grid-template-columns: 1fr;
        }

        .detail {
          flex-direction: row;
        }

        .detail__hero {
          flex: 0 0 38%;
          min-height: 100%;
        }

        .detail__body {
          flex: 1;
        }
      }

      @media (max-width: 720px) {
        .toolbar {
          border-radius: var(--r-md);
        }

        .toolbar__search {
          flex-basis: 100%;
        }

        .detail {
          flex-direction: column;
        }

        .detail__hero {
          min-height: 130px;
        }

        .circuit-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }
      }
    `,
  ],
})
export class CircuitsComponent implements OnInit {
  private readonly csv = inject(CSVDataService);

  readonly archiveEnd = ARCHIVE_END_YEAR;
  readonly circuits = signal<CircuitCareer[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly sort = signal<CircuitSort>('races');
  readonly selected = signal<CircuitCareer | null>(null);
  readonly brokenMaps = signal<Set<string>>(new Set());

  readonly countryCount = computed(
    () => new Set(this.circuits().map((circuit) => circuit.country)).size,
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = this.circuits();

    if (term) {
      list = list.filter((circuit) =>
        `${circuit.name} ${circuit.location} ${circuit.country} ${circuit.circuitRef}`
          .toLowerCase()
          .includes(term),
      );
    }

    const sorted = [...list];
    switch (this.sort()) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        sorted.sort((a, b) => (b.lastYear ?? 0) - (a.lastYear ?? 0) || b.races - a.races);
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.firstYear ?? 9999) - (b.firstYear ?? 9999));
        break;
      default:
        sorted.sort((a, b) => b.races - a.races || a.name.localeCompare(b.name));
    }
    return sorted;
  });

  readonly mapped = computed<MapPoint[]>(() =>
    this.circuits()
      .filter((circuit) => circuit.lat !== null && circuit.lng !== null)
      .map((circuit) => ({
        circuit,
        x: ((circuit.lng! + 180) / 360) * 640,
        y: ((90 - circuit.lat!) / 180) * 264 + 12,
        active: this.selected()?.circuitId === circuit.circuitId,
      })),
  );

  ngOnInit(): void {
    this.csv.getCircuits().subscribe((circuits) => {
      this.circuits.set(circuits);
      this.loading.set(false);
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as CircuitSort);
  }

  select(circuit: CircuitCareer): void {
    this.selected.set(this.selected()?.circuitId === circuit.circuitId ? null : circuit);
  }

  mapFor(circuit: CircuitCareer): string | null {
    const file = CIRCUIT_MAPS[circuit.circuitRef];
    if (!file || this.brokenMaps().has(circuit.circuitRef)) return null;
    return `/assets/images/circuits/${file}`;
  }

  onMapError(circuit: CircuitCareer): void {
    this.brokenMaps.update((broken) => new Set(broken).add(circuit.circuitRef));
  }

  flag(country: string): string {
    return countryFlag(country);
  }

  code(country: string): string {
    return countryCode(country);
  }
}
