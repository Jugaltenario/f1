import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { DriverCareer, DriverSeasonRow } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';

@Component({
  selector: 'app-driver-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatDialogModule,
    DriverAvatarComponent,
    TeamBadgeComponent,
    StatTileComponent,
  ],
  template: `
    <div class="profile" [style.--profile-accent]="driver.teamColor">
      <header class="profile__hero" [style.--profile-accent]="driver.teamColor">

        <button type="button" class="profile__close" mat-dialog-close aria-label="Close profile">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>

        <app-driver-avatar
          [forename]="driver.forename"
          [surname]="driver.surname"
          [driverRef]="driver.driverRef"
          [color]="driver.teamColor"
          size="xl"
        />

        <div class="profile__identity">
          <span class="eyebrow">
            {{ driver.active ? 'Active driver' : 'Retired' }} · {{ driver.nationality }}
          </span>
          <h2>{{ driver.forename }} <span>{{ driver.surname }}</span></h2>
          <div class="profile__meta">
            @if (driver.number) {
              <span class="profile__number">#{{ driver.number }}</span>
            }
            @if (driver.code) {
              <span class="pill">{{ driver.code }}</span>
            }
            <app-team-badge
              [name]="driver.teamName"
              [teamRef]="driver.teamRef"
              [color]="driver.teamColor"
            />
            @if (driver.debutYear) {
              <span class="dim">{{ driver.debutYear }}–{{ driver.active ? 'now' : driver.lastYear }}</span>
            }
          </div>
        </div>

        <div class="profile__titles">
          <span class="profile__titles-count display">{{ driver.championships }}</span>
          <span class="profile__titles-label">World titles</span>
        </div>
      </header>

      <div class="profile__body">
        <section class="profile__stats">
          <app-stat-tile label="Starts" [value]="driver.starts" />
          <app-stat-tile label="Wins" [value]="driver.wins" [accent]="driver.teamColor" />
          <app-stat-tile label="Podiums" [value]="driver.podiums" />
          <app-stat-tile label="Poles" [value]="driver.poles" />
          <app-stat-tile label="Points" [value]="driver.points" />
          <app-stat-tile label="Seasons" [value]="driver.seasonsCount" />
        </section>

        <section class="profile__seasons">
          <div class="profile__section-head">
            <h3>Season by season</h3>
            <span class="pill">{{ seasons().length }} campaigns</span>
          </div>

          @if (!seasons().length) {
            <p class="dim">No season data available.</p>
          } @else {
            <div class="season-table" role="table" aria-label="Season history">
              <div class="season-table__head" role="row">
                <span>Year</span>
                <span>Team</span>
                <span>Pos</span>
                <span>Points</span>
                <span class="hide-xs">Wins</span>
                <span class="hide-xs">Podiums</span>
                <span class="hide-sm">Poles</span>
              </div>
              @for (season of seasons(); track season.year) {
                <div class="season-table__row" role="row" [style.--season-color]="season.teamColor">
                  <span class="tabular season-table__year">{{ season.year }}</span>
                  <span class="season-table__team">
                    <span class="season-table__swatch"></span>
                    {{ season.teamName }}
                  </span>
                  <span class="tabular">{{ season.position }}</span>
                  <span class="tabular">{{ season.points }}</span>
                  <span class="tabular hide-xs">{{ season.wins }}</span>
                  <span class="tabular hide-xs">{{ season.podiums }}</span>
                  <span class="tabular hide-sm">{{ season.poles }}</span>
                </div>
              }
            </div>
          }
        </section>
      </div>

      <footer class="profile__footer">
        <a class="btn btn--ghost btn--sm" routerLink="/standings" [queryParams]="{ year: driver.lastYear }" (click)="close()">
          View {{ driver.lastYear }} standings
        </a>
        <div class="profile__footer-actions">
          <button type="button" class="btn btn--sm" (click)="compare()">Compare career</button>
          <button type="button" class="btn btn--primary btn--sm" mat-dialog-close>Close</button>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .profile {
        display: flex;
        flex-direction: column;
        max-height: min(86vh, 900px);
        overflow: hidden;
        background: transparent;
      }

      .profile__hero {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1.75rem 1.75rem 1.5rem;
        border-bottom: 1px solid var(--divider);
        border-top: 2px solid var(--profile-accent, var(--border));
        overflow: hidden;
      }

      .profile__close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: var(--text-2);
        background: var(--surface-2);
        border: 1px solid var(--border);
        z-index: 1;
      }

      .profile__close:hover {
        color: var(--text);
        background: var(--surface-3);
      }

      .profile__close svg {
        width: 16px;
        height: 16px;
      }

      .profile__identity {
        position: relative;
        min-width: 0;
        flex: 1;
      }

      .profile__identity h2 {
        margin: 0.25rem 0 0.45rem;
        font-size: clamp(1.5rem, 3.4vw, 2.15rem);
        letter-spacing: -0.04em;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .profile__identity h2 span {
        color: color-mix(in srgb, var(--profile-accent) 55%, var(--text));
      }

      .profile__meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        font-size: 0.78rem;
      }

      .profile__number {
        font-family: var(--font-display);
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--profile-accent);
      }

      .profile__titles {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.6rem 1rem;
        border-radius: var(--r-md);
        border: 1px solid color-mix(in srgb, var(--profile-accent) 35%, var(--border));
        background: color-mix(in srgb, var(--profile-accent) 12%, var(--surface-2));
        min-width: 92px;
      }

      .profile__titles-count {
        font-size: 2.3rem;
        color: var(--profile-accent);
        line-height: 1;
      }

      .profile__titles-label {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
        text-align: center;
      }

      .profile__body {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1.5rem 1.75rem;
        overflow-y: auto;
      }

      .profile__stats {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.6rem;
      }

      .profile__seasons {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .profile__section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .profile__section-head h3 {
        font-size: 1rem;
      }

      .season-table {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--divider);
        border-radius: var(--r-md);
        overflow: hidden;
      }

      .season-table__head,
      .season-table__row {
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr) 44px 62px 52px 68px 52px;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.78rem;
      }

      .season-table__head {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-3);
        background: var(--surface-2);
      }

      .season-table__row {
        border-top: 1px solid var(--divider);
        color: var(--text-2);
      }

      .season-table__row:hover {
        background: var(--surface-2);
        color: var(--text);
      }

      .season-table__year {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--text);
      }

      .season-table__team {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .season-table__swatch {
        width: 4px;
        height: 16px;
        border-radius: 2px;
        background: var(--season-color, var(--text-3));
        flex: 0 0 auto;
      }

      .profile__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.75rem;
        border-top: 1px solid var(--divider);
        background: color-mix(in srgb, var(--bg-2) 45%, transparent);
      }

      .profile__footer-actions {
        display: flex;
        gap: 0.5rem;
      }

      @media (max-width: 820px) {
        .profile__stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .profile__hero {
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .profile__titles {
          flex-direction: row;
          gap: 0.5rem;
          padding: 0.5rem 0.8rem;
        }

        .profile__titles-count {
          font-size: 1.5rem;
        }

        .profile__titles-label {
          text-align: left;
        }
      }

      @media (max-width: 640px) {
        .profile__hero,
        .profile__body,
        .profile__footer {
          padding-left: 1rem;
          padding-right: 1rem;
        }

        .hide-xs {
          display: none;
        }

        .season-table__head,
        .season-table__row {
          grid-template-columns: 48px minmax(0, 1fr) 36px 54px 52px;
        }

        .profile__footer {
          align-items: stretch;
          flex-direction: column;
        }

        .profile__footer-actions {
          justify-content: flex-end;
        }
      }

      @media (max-width: 460px) {
        .hide-sm {
          display: none;
        }

        .season-table__head,
        .season-table__row {
          grid-template-columns: 48px minmax(0, 1fr) 36px 54px;
        }
      }
    `,
  ],
})
export class DriverProfileDialogComponent {
  private readonly csv = inject(CSVDataService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<DriverProfileDialogComponent>);
  readonly driver = inject<DriverCareer>(MAT_DIALOG_DATA);

  readonly seasons = signal<DriverSeasonRow[]>([]);

  constructor() {
    this.csv.getDriverSeasons(this.driver.driverId).subscribe((seasons) => this.seasons.set(seasons));
  }

  close(): void {
    this.dialogRef.close();
  }

  compare(): void {
    const id = this.driver.driverId;
    this.dialogRef.close();
    this.router.navigate(['/rivalry'], { queryParams: { driver1: id } });
  }
}
