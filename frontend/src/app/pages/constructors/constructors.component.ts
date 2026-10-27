import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ConstructorCareer } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { ARCHIVE_END_YEAR } from '../../core/config/data.config';
import { TEAM_LOGOS } from '../../core/config/asset-manifest';
import { PanelComponent } from '../../shared/components/panel/panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

type TeamFilter = 'all' | 'champions' | 'active';
type TeamSort = 'titles' | 'wins' | 'seasons' | 'name';

@Component({
  selector: 'app-constructors',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PanelComponent,
    PageHeaderComponent,
    TeamBadgeComponent,
    StatTileComponent,
    DriverAvatarComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page constructors-page">
      <app-page-header
        eyebrow="Constructors · 2000 → {{ archiveEnd }}"
        title="Teams"
        subtitle="Forty constructors have raced in the modern era. Every title, every win, every driver who wore the colours."
      >
        <span class="pill">{{ teams().length }} teams</span>
        <span class="pill">{{ championTeams() }} champions</span>
      </app-page-header>

      @if (loading()) {
        <app-skeleton-loader [count]="4" [height]="100" />
      } @else {
        <section class="records">
          @for (record of records(); track record.label) {
            <button type="button" class="record panel" [style.--record-accent]="record.team.color" (click)="select(record.team)">
              <span class="record__label">{{ record.label }}</span>
              <div class="record__body">
                <span class="record__monogram" [style.background]="record.team.color">{{ monogram(record.team) }}</span>
                <span class="record__who">
                  <strong>{{ record.team.name }}</strong>
                  <small>{{ record.team.nationality }} · {{ record.team.seasonsCount }} seasons</small>
                </span>
                <span class="record__value display">{{ record.value }}</span>
              </div>
            </button>
          }
        </section>

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
              placeholder="Search teams or nationalities…"
              aria-label="Search teams"
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
            <select [value]="sort()" (change)="onSort($event)" aria-label="Sort teams">
              <option value="titles">Most titles</option>
              <option value="wins">Most wins</option>
              <option value="seasons">Longest service</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </section>

        <!-- --------------------------------------------------------- detail panel -->
        @if (selected(); as team) {
          <app-panel class="team-detail" variant="accent" [accent]="team.color">
            <div class="team-detail__head">
              <div class="team-detail__title">
                <span class="team-detail__monogram" [style.background]="team.color">{{ monogram(team) }}</span>
                <div>
                  <span class="eyebrow">{{ team.nationality }} · {{ team.firstYear }}–{{ team.active ? 'now' : team.lastYear }}</span>
                  <h2>{{ team.name }}</h2>
                  <app-team-badge [name]="team.name" [teamRef]="team.constructorRef" [color]="team.color" />
                </div>
              </div>
              <button type="button" class="team-detail__close" aria-label="Close team detail" (click)="selected.set(null)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="team-detail__grid">
              <div class="team-detail__stats">
                <app-stat-tile label="Titles" [value]="team.championYears.length" [accent]="team.color" />
                <app-stat-tile label="Wins" [value]="team.wins" [accent]="team.color" />
                <app-stat-tile label="Podiums" [value]="team.podiums" />
                <app-stat-tile label="Seasons" [value]="team.seasonsCount" />
                <app-stat-tile label="Drivers" [value]="team.driversCount" />
              </div>

              <div class="team-detail__side">
                @if (team.championYears.length) {
                  <div class="team-detail__block">
                    <span class="eyebrow">Championship years</span>
                    <div class="team-detail__years">
                      @for (year of team.championYears; track year) {
                        <a class="team-detail__year" [routerLink]="'/standings'" [queryParams]="{ year }">{{ year }}</a>
                      }
                    </div>
                  </div>
                }

                <div class="team-detail__block">
                  <span class="eyebrow">Drivers</span>
                  <div class="team-detail__drivers">
                    @for (driver of team.drivers; track driver.driverId) {
                      <a class="team-detail__driver" [routerLink]="'/drivers'" [queryParams]="{ driver: driver.driverId }">
                        <app-driver-avatar
                          [forename]="driver.forename"
                          [surname]="driver.surname"
                          [driverRef]="driver.driverRef"
                          [color]="team.color"
                          size="xs"
                        />
                        <span>{{ driver.surname }}</span>
                      </a>
                    }
                  </div>
                </div>

                <a class="btn btn--sm" routerLink="/standings" [queryParams]="{ year: team.lastYear }">
                  Last season standings
                </a>
              </div>
            </div>
          </app-panel>
        }

        <!-- ---------------------------------------------------------------- grid -->
        @if (!filtered().length) {
          <app-empty-state
            icon="🔍"
            title="No teams match those filters"
            message="Try clearing the search or switching back to all teams."
            actionLabel="Reset filters"
            actionLink="/constructors"
          />
        } @else {
          <div class="team-grid">
            @for (team of filtered(); track team.constructorId) {
              <button type="button" class="team-card-button" (click)="select(team)">
                <app-panel variant="default" [interactive]="true" [accent]="team.color">
                  <article class="team-tile" [style.--team-color]="team.color" [class.is-selected]="selected()?.constructorId === team.constructorId">
                    <div class="team-tile__head">
                      <span class="team-tile__monogram" [style.background]="team.color">
                        @if (hasLogo(team)) {
                          <img
                            [src]="'/assets/images/teams/' + logoFile(team)"
                            [alt]="team.name"
                            loading="lazy"
                            (error)="logoError(team.constructorRef)"
                          />
                        } @else {
                          {{ monogram(team) }}
                        }
                      </span>
                      <span class="team-tile__era tabular">{{ team.firstYear }}–{{ team.active ? 'now' : team.lastYear }}</span>
                    </div>

                    <div class="team-tile__identity">
                      <h3>{{ team.name }}</h3>
                      <span>{{ team.nationality }}</span>
                    </div>

                    <div class="team-tile__stats">
                      <span><strong class="tabular">{{ team.championYears.length }}</strong> titles</span>
                      <span><strong class="tabular">{{ team.wins }}</strong> wins</span>
                      <span><strong class="tabular">{{ team.seasonsCount }}</strong> seasons</span>
                    </div>

                    @if (team.championYears.length) {
                      <div class="team-tile__years">
                        @for (year of recentTitles(team); track year) {
                          <span class="team-tile__year">{{ year }}</span>
                        }
                        @if (team.championYears.length > 3) {
                          <span class="team-tile__year team-tile__year--more">+{{ team.championYears.length - 3 }}</span>
                        }
                      </div>
                    } @else {
                      <span class="team-tile__none">Chasing a first title</span>
                    }
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
        gap: 0.6rem;
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

      .record__monogram {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        flex: 0 0 auto;
        border-radius: 8px;
        font-family: var(--font-display);
        font-size: 0.7rem;
        font-weight: 700;
        color: #fff;
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
        font-size: 0.64rem;
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
        margin-bottom: 1rem;
      }

      .toolbar__search {
        flex: 1 1 260px;
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
      }

      .team-detail {
        margin-bottom: 1.25rem;
        animation: popIn var(--dur) var(--ease-out) both;
      }

      .team-detail__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.5rem 1.5rem 1rem;
      }

      .team-detail__title {
        display: flex;
        gap: 1rem;
        min-width: 0;
      }

      .team-detail__monogram {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        flex: 0 0 auto;
        border-radius: 16px;
        font-family: var(--font-display);
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
      }

      .team-detail__title h2 {
        font-size: clamp(1.4rem, 3vw, 2rem);
        letter-spacing: -0.035em;
        margin: 0.2rem 0 0.35rem;
      }

      .team-detail__close {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: var(--text-2);
        background: var(--surface-2);
        border: 1px solid var(--border);
        flex: 0 0 auto;
      }

      .team-detail__close:hover {
        color: var(--text);
      }

      .team-detail__close svg {
        width: 16px;
        height: 16px;
      }

      .team-detail__grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
        gap: 1.25rem;
        padding: 0 1.5rem 1.5rem;
      }

      .team-detail__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.6rem;
      }

      .team-detail__side {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .team-detail__block {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .team-detail__years,
      .team-detail__drivers {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
      }

      .team-detail__year {
        padding: 0.22rem 0.5rem;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .team-detail__year:hover {
        color: var(--text);
        border-color: var(--accent);
      }

      .team-detail__driver {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.5rem 0.2rem 0.2rem;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .team-detail__driver:hover {
        color: var(--text);
        border-color: var(--border-strong);
      }

      .team-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }

      .team-card-button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0;
        color: var(--text);
      }

      .team-card-button app-panel {
        display: block;
        height: 100%;
      }

      .team-tile {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 1.15rem;
        height: 100%;
      }

      .team-tile__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .team-tile__monogram {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 11px;
        font-family: var(--font-display);
        font-size: 0.8rem;
        font-weight: 700;
        color: #fff;
        overflow: hidden;
      }

      .team-tile__monogram img {
        width: 76%;
        height: 76%;
        object-fit: contain;
      }

      .team-tile__era {
        font-size: 0.66rem;
        color: var(--text-3);
      }

      .team-tile__identity h3 {
        font-size: 1.05rem;
        letter-spacing: -0.02em;
      }

      .team-tile__identity span {
        font-size: 0.68rem;
        color: var(--text-3);
      }

      .team-tile__stats {
        display: flex;
        gap: 0.9rem;
        margin-top: auto;
        padding-top: 0.7rem;
        border-top: 1px solid var(--divider);
        font-size: 0.64rem;
        color: var(--text-3);
      }

      .team-tile__stats strong {
        display: block;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--text);
      }

      .team-tile__years {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }

      .team-tile__year {
        padding: 0.1rem 0.38rem;
        border-radius: 4px;
        font-size: 0.6rem;
        font-weight: 600;
        color: var(--accent);
        background: rgba(242, 193, 78, 0.1);
      }

      .team-tile__year--more {
        color: var(--text-3);
        background: var(--surface-2);
      }

      .team-tile__none {
        font-size: 0.62rem;
        color: var(--text-3);
      }

      .team-tile.is-selected {
        outline: 1px solid color-mix(in srgb, var(--team-color) 55%, transparent);
        outline-offset: -4px;
        border-radius: var(--r-lg);
      }

      .team-detail__stats app-stat-tile {
        display: block;
      }

      @media (max-width: 1080px) {
        .records {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 860px) {
        .team-detail__grid {
          grid-template-columns: 1fr;
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

        .records {
          grid-template-columns: 1fr;
        }

        .team-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }

        .team-detail__stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class ConstructorsComponent implements OnInit {
  private readonly csv = inject(CSVDataService);

  readonly archiveEnd = ARCHIVE_END_YEAR;
  readonly teams = signal<ConstructorCareer[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly filter = signal<TeamFilter>('all');
  readonly sort = signal<TeamSort>('titles');
  readonly selected = signal<ConstructorCareer | null>(null);
  readonly brokenLogos = signal<Set<string>>(new Set());

  readonly filterOptions: { value: TeamFilter; label: string }[] = [
    { value: 'all', label: 'All teams' },
    { value: 'champions', label: 'Champions' },
    { value: 'active', label: 'Active' },
  ];

  readonly championTeams = computed(() => this.teams().filter((team) => team.championYears.length > 0).length);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = this.teams();

    if (this.filter() === 'champions') list = list.filter((team) => team.championYears.length > 0);
    if (this.filter() === 'active') list = list.filter((team) => team.active);
    if (term) {
      list = list.filter((team) =>
        `${team.name} ${team.nationality} ${team.constructorRef}`.toLowerCase().includes(term),
      );
    }

    const sorted = [...list];
    switch (this.sort()) {
      case 'wins':
        sorted.sort((a, b) => b.wins - a.wins || b.championYears.length - a.championYears.length);
        break;
      case 'seasons':
        sorted.sort((a, b) => b.seasonsCount - a.seasonsCount || b.wins - a.wins);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort(
          (a, b) =>
            b.championYears.length - a.championYears.length || b.wins - a.wins || b.podiums - a.podiums,
        );
    }
    return sorted;
  });

  readonly records = computed(() => {
    const teams = this.teams();
    if (!teams.length) return [];

    const mostTitles = [...teams].sort((a, b) => b.championYears.length - a.championYears.length || b.wins - a.wins)[0];
    const mostWins = [...teams].sort((a, b) => b.wins - a.wins)[0];
    const mostSeasons = [...teams].sort((a, b) => b.seasonsCount - a.seasonsCount)[0];
    const mostDrivers = [...teams].sort((a, b) => b.driversCount - a.driversCount)[0];

    return [
      { label: 'Most titles', team: mostTitles, value: mostTitles.championYears.length },
      { label: 'Most victories', team: mostWins, value: mostWins.wins },
      { label: 'Longest service', team: mostSeasons, value: mostSeasons.seasonsCount },
      { label: 'Most drivers', team: mostDrivers, value: mostDrivers.driversCount },
    ];
  });

  ngOnInit(): void {
    this.csv.getConstructors().subscribe((teams) => {
      this.teams.set(teams);
      this.loading.set(false);
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as TeamSort);
  }

  select(team: ConstructorCareer): void {
    this.selected.set(this.selected()?.constructorId === team.constructorId ? null : team);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  monogram(team: ConstructorCareer): string {
    return team.name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  hasLogo(team: ConstructorCareer): boolean {
    return !!TEAM_LOGOS[team.constructorRef] && !this.brokenLogos().has(team.constructorRef);
  }

  logoFile(team: ConstructorCareer): string | null {
    return TEAM_LOGOS[team.constructorRef] ?? null;
  }

  logoError(ref: string): void {
    this.brokenLogos.update((current) => new Set(current).add(ref));
  }

  recentTitles(team: ConstructorCareer): number[] {
    return team.championYears.slice(-3).reverse();
  }
}
