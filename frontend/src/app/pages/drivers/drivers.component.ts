import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { DriverCareer } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { ARCHIVE_END_YEAR } from '../../core/config/data.config';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DriverProfileDialogComponent } from './driver-profile-dialog.component';

type DriverFilter = 'all' | 'champions' | 'active';
type SortKey = 'titles' | 'wins' | 'podiums' | 'name' | 'recent';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [
    CommonModule,
    PanelComponent,
    PageHeaderComponent,
    DriverAvatarComponent,
    TeamBadgeComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page drivers-page">
      <app-page-header
        eyebrow="Careers · 2000 → {{ archiveEnd }}"
        title="Drivers"
        subtitle="Every driver to start a world championship round in the modern era. Open a card for the full career and season-by-season record."
      >
        <span class="pill">{{ drivers().length }} drivers</span>
        <span class="pill">{{ championCount() }} champions</span>
      </app-page-header>

      <!-- ------------------------------------------------------ record holders -->
      @if (loading()) {
        <app-skeleton-loader [count]="4" [height]="108" />
      } @else {
        <section class="records">
          @for (record of records(); track record.label) {
            <button type="button" class="record panel" (click)="open(record.driver)" [style.--record-accent]="record.driver.teamColor">
              <span class="record__label">{{ record.label }}</span>
              <div class="record__body">
                <app-driver-avatar
                  [forename]="record.driver.forename"
                  [surname]="record.driver.surname"
                  [driverRef]="record.driver.driverRef"
                  [color]="record.driver.teamColor"
                  size="sm"
                />
                <span class="record__who">
                  <strong>{{ record.driver.forename }} {{ record.driver.surname }}</strong>
                  <small>{{ record.driver.teamName }}</small>
                </span>
                <span class="record__value display">{{ record.value }}</span>
              </div>
            </button>
          }
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
              placeholder="Search by name, code or nationality…"
              aria-label="Search drivers"
            />
          </label>

          <div class="chip-set toolbar__filters">
            @for (option of filterOptions; track option.value) {
              <button
                type="button"
                class="chip"
                [class.is-active]="filter() === option.value"
                (click)="filter.set(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>

          <div class="field toolbar__select">
            <select [value]="nationality()" (change)="onNationality($event)" aria-label="Filter by nationality">
              <option value="all">All nationalities</option>
              @for (nation of nationalities(); track nation) {
                <option [value]="nation">{{ nation }}</option>
              }
            </select>
          </div>

          <div class="field toolbar__select">
            <select [value]="sort()" (change)="onSort($event)" aria-label="Sort drivers">
              <option value="titles">Most titles</option>
              <option value="wins">Most wins</option>
              <option value="podiums">Most podiums</option>
              <option value="recent">Most recent</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </section>

        <div class="results-line">
          <span class="muted">
            Showing <strong>{{ filtered().length }}</strong> of {{ drivers().length }} drivers
            @if (filter() === 'active') {
              · active in {{ latestYear }}
            }
          </span>
          @if (search() || filter() !== 'all' || nationality() !== 'all') {
            <button type="button" class="btn btn--ghost btn--sm" (click)="reset()">Clear filters</button>
          }
        </div>

        <!-- ---------------------------------------------------------------- grid -->
        @if (loading()) {
          <div class="driver-grid">
            @for (placeholder of [1, 2, 3, 4, 5, 6, 7, 8]; track placeholder) {
              <div class="skeleton" style="height: 320px; border-radius: var(--r-lg)"></div>
            }
          </div>
        } @else if (!filtered().length) {
          <app-empty-state
            icon="🔍"
            title="No drivers match those filters"
            message="Try a different nationality, or switch back to all drivers."
            actionLabel="Reset filters"
            actionLink="/drivers"
          />
        } @else {
          <div class="driver-grid">
            @for (driver of filtered(); track driver.driverId) {
              <button type="button" class="driver-card-button" (click)="open(driver)">
                <app-panel variant="default" [interactive]="true" [accent]="driver.teamColor">
                  <article class="driver-tile">
                    <div class="driver-tile__top">
                      <span class="driver-tile__number" [style.color]="driver.teamColor">
                        {{ driver.number ? '#' + driver.number : driver.code || '—' }}
                      </span>
                      @if (driver.championships > 0) {
                        <span class="driver-tile__titles">
                          {{ driver.championships }}× champion
                        </span>
                      } @else if (driver.active) {
                        <span class="pill">Active</span>
                      }
                    </div>

                    <app-driver-avatar
                      [forename]="driver.forename"
                      [surname]="driver.surname"
                      [driverRef]="driver.driverRef"
                      [color]="driver.teamColor"
                      size="lg"
                    />

                    <div class="driver-tile__identity">
                      <h3>
                        {{ driver.forename }}
                        <strong>{{ driver.surname }}</strong>
                      </h3>
                      <span class="driver-tile__meta">
                        {{ driver.nationality }}
                        @if (driver.code) {
                          · {{ driver.code }}
                        }
                      </span>
                    </div>

                    <app-team-badge
                      [name]="driver.teamName"
                      [teamRef]="driver.teamRef"
                      [color]="driver.teamColor"
                    />

                    <div class="driver-tile__stats">
                      <span><strong class="tabular">{{ driver.wins }}</strong> wins</span>
                      <span><strong class="tabular">{{ driver.podiums }}</strong> podiums</span>
                      <span><strong class="tabular">{{ driver.poles }}</strong> poles</span>
                    </div>

                    <span class="driver-tile__years">
                      {{ driver.debutYear }}–{{ driver.active ? 'now' : driver.lastYear }}
                      · {{ driver.seasonsCount }} seasons
                    </span>
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

      .records {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 1.25rem;
      }

      .record {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.9rem 1rem;
        border-radius: var(--r-md);
        text-align: left;
        color: var(--text);
        transition:
          transform var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease);
      }

      .record:hover {
        transform: translateY(-3px);
        border-color: color-mix(in srgb, var(--record-accent) 45%, var(--border));
      }

      .record__label {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .record__body {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .record__who {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }

      .record__who strong {
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .record__who small {
        font-size: 0.66rem;
        color: var(--text-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .record__value {
        font-size: 1.5rem;
        color: var(--record-accent);
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
        flex: 1 1 260px;
        min-width: 0;
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

      .toolbar__filters {
        background: transparent;
        border: 0;
        padding: 0;
      }

      .toolbar__select {
        padding: 0.45rem 0.85rem;
        background: var(--surface-2);
      }

      .toolbar__select select {
        font-size: 0.8rem;
        font-weight: 600;
        padding-right: 0.25rem;
      }

      .results-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin: 0.5rem 0 1rem;
        font-size: 0.78rem;
      }

      .results-line strong {
        color: var(--text);
      }

      .driver-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
        gap: 1rem;
      }

      .driver-card-button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0;
        color: var(--text);
      }

      .driver-card-button app-panel {
        display: block;
        height: 100%;
      }

      .driver-tile {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.55rem;
        padding: 1.15rem;
        height: 100%;
      }

      .driver-tile__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 0.5rem;
      }

      .driver-tile__number {
        font-family: var(--font-display);
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .driver-tile__titles {
        padding: 0.18rem 0.45rem;
        border-radius: 999px;
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--accent);
        background: rgba(242, 193, 78, 0.12);
        border: 1px solid rgba(242, 193, 78, 0.3);
      }

      .driver-tile app-driver-avatar {
        margin: 0.35rem 0 0.15rem;
      }

      .driver-tile__identity h3 {
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        font-weight: 500;
        line-height: 1.1;
        letter-spacing: -0.01em;
      }

      .driver-tile__identity h3 strong {
        font-weight: 700;
      }

      .driver-tile__meta {
        font-size: 0.68rem;
        color: var(--text-3);
      }

      .driver-tile__stats {
        display: flex;
        gap: 0.9rem;
        width: 100%;
        margin-top: auto;
        padding-top: 0.7rem;
        border-top: 1px solid var(--divider);
        font-size: 0.66rem;
        color: var(--text-3);
      }

      .driver-tile__stats strong {
        display: block;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text);
      }

      .driver-tile__years {
        font-size: 0.63rem;
        color: var(--text-3);
        letter-spacing: 0.02em;
      }

      @media (max-width: 1080px) {
        .records {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .toolbar {
          border-radius: var(--r-md);
        }

        .toolbar__search {
          flex-basis: 100%;
        }

        .toolbar__filters {
          width: 100%;
        }

        .toolbar__select {
          flex: 1;
        }

        .records {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DriversComponent implements OnInit {
  private readonly csv = inject(CSVDataService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly drivers = signal<DriverCareer[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly filter = signal<DriverFilter>('all');
  readonly nationality = signal('all');
  readonly sort = signal<SortKey>('titles');
  readonly latestYear = ARCHIVE_END_YEAR;
  readonly archiveEnd = ARCHIVE_END_YEAR;

  readonly filterOptions: { value: DriverFilter; label: string }[] = [
    { value: 'all', label: 'All drivers' },
    { value: 'champions', label: 'Champions' },
    { value: 'active', label: 'Active' },
  ];

  readonly nationalities = computed(() =>
    [...new Set(this.drivers().map((driver) => driver.nationality).filter(Boolean))].sort(),
  );

  readonly championCount = computed(() => this.drivers().filter((driver) => driver.championships > 0).length);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const nationality = this.nationality();
    const filter = this.filter();

    let list = this.drivers();

    if (filter === 'champions') list = list.filter((driver) => driver.championships > 0);
    if (filter === 'active') list = list.filter((driver) => driver.active);
    if (nationality !== 'all') list = list.filter((driver) => driver.nationality === nationality);
    if (term) {
      list = list.filter((driver) =>
        `${driver.forename} ${driver.surname} ${driver.code ?? ''} ${driver.nationality}`.toLowerCase().includes(term),
      );
    }

    const sorted = [...list];
    switch (this.sort()) {
      case 'wins':
        sorted.sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);
        break;
      case 'podiums':
        sorted.sort((a, b) => b.podiums - a.podiums || b.wins - a.wins);
        break;
      case 'recent':
        sorted.sort((a, b) => (b.lastYear ?? 0) - (a.lastYear ?? 0) || b.wins - a.wins);
        break;
      case 'name':
        sorted.sort((a, b) => a.surname.localeCompare(b.surname));
        break;
      default:
        sorted.sort((a, b) => b.championships - a.championships || b.wins - a.wins || b.podiums - a.podiums);
    }
    return sorted;
  });

  readonly records = computed(() => {
    const drivers = this.drivers();
    if (!drivers.length) return [];

    const mostTitles = [...drivers].sort((a, b) => b.championships - a.championships || b.wins - a.wins)[0];
    const mostWins = [...drivers].sort((a, b) => b.wins - a.wins)[0];
    const mostPodiums = [...drivers].sort((a, b) => b.podiums - a.podiums)[0];
    const mostStarts = [...drivers].sort((a, b) => b.starts - a.starts)[0];

    return [
      { label: 'Most world titles', driver: mostTitles, value: mostTitles.championships },
      { label: 'Most race wins', driver: mostWins, value: mostWins.wins },
      { label: 'Most podiums', driver: mostPodiums, value: mostPodiums.podiums },
      { label: 'Most starts', driver: mostStarts, value: mostStarts.starts },
    ];
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('driver'));
      if (!Number.isFinite(id) || id <= 0) return;
      const driver = this.drivers().find((item) => item.driverId === id);
      if (driver) {
        this.open(driver);
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    });
  }

  ngOnInit(): void {
    this.csv.getDrivers().subscribe((drivers) => {
      this.drivers.set(drivers);
      this.loading.set(false);

      const id = Number(this.route.snapshot.queryParamMap.get('driver'));
      const driver = drivers.find((item) => item.driverId === id);
      if (driver) {
        this.open(driver);
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onNationality(event: Event): void {
    this.nationality.set((event.target as HTMLSelectElement).value);
  }

  onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as SortKey);
  }

  reset(): void {
    this.search.set('');
    this.filter.set('all');
    this.nationality.set('all');
  }

  open(driver: DriverCareer): void {
    this.dialog.open(DriverProfileDialogComponent, {
      data: driver,
      width: 'min(920px, 94vw)',
      maxWidth: '920px',
      autoFocus: 'dialog',
      panelClass: 'profile-dialog',
    });
  }
}
