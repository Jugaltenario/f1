import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ChampionRow, DriverCareer, Race } from '../../core/models/driver.model';
import { CSVDataService } from '../../core/services/csv-data.service';
import { DATA_THROUGH } from '../../core/config/data.config';
import { HISTORY_PHOTOS } from '../../core/config/asset-manifest';
import { DriverAvatarComponent } from '../../shared/components/driver-avatar/driver-avatar.component';
import { TeamBadgeComponent } from '../../shared/components/team-badge/team-badge.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';

interface EraDefinition {
  id: string;
  startYear: number;
  endYear: number;
  title: string;
  lead: string;
  body: string;
  photo?: { key: string; caption: string };
}

interface Era extends EraDefinition {
  champions: ChampionRow[];
  races: number;
  titleLeaders: { name: string; titles: number }[];
}

interface Rivalry {
  id: string;
  title: string;
  years: string;
  photo: string;
  caption: string;
  text: string;
  driver1Id: number | null;
  driver2Id: number | null;
  names: string;
}

interface RecordRow {
  label: string;
  value: string;
  holder: DriverCareer | null;
}

const photo = (key: string): string | null =>
  HISTORY_PHOTOS[key] ? `/assets/images/history/${HISTORY_PHOTOS[key]}` : null;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DriverAvatarComponent,
    TeamBadgeComponent,
    SkeletonLoaderComponent,
  ],
  template: `
    <div class="page history">
      <article>
        <!-- ------------------------------------------------------------ masthead -->
        <header class="masthead">
          <span class="eyebrow">History of Formula One</span>
          <h1>The modern era</h1>
          <p class="masthead__standfirst">
            From Ferrari's crimson dynasty at the turn of the millennium to the ground-effect
            generation still racing today — the champions, machines and rivalries that shaped
            Formula One between 2000 and {{ year }}.
          </p>
          <div class="masthead__meta">
            <span>Archive 2000–{{ year }}</span>
            <span>·</span>
            <span>{{ champions().length }} completed seasons</span>
            <span>·</span>
            <span>Last reconciled {{ through }}</span>
          </div>
        </header>

        @if (loading()) {
          <app-skeleton-loader [count]="3" [height]="140" />
        } @else {
          <!-- -------------------------------------------------------------- lead -->
          <section class="lead" id="lead">
            <div class="lead__body prose">
              <p>
                <strong>Formula One</strong> entered the twenty-first century as a sport of
                manufacturers, tyre wars and increasingly sophisticated aerodynamics. Ferrari's
                five-year lock on the drivers' championship gave way to a period of rapid change:
                Renault's rise, the arrival of Lewis Hamilton, a team bought for one pound that won
                both titles, and then the longest period of single-team dominance the sport has
                seen.
              </p>
              <p>
                The 2014 turbo-hybrid regulations redrew the competitive order and handed Mercedes
                a run of eight consecutive constructors' championships. The ground-effect cars of
                2022 reset the field once more, and Red Bull answered with four straight titles
                before McLaren returned to the front in 2024. The 2026 season — the largest
                regulation change in the sport's history — is still being written.
              </p>
            </div>

            <aside class="infobox" aria-label="At a glance">
              <h2>At a glance</h2>
              @if (mp4()) {
                <figure class="infobox__figure">
                  <img [src]="mp4()!" alt="McLaren MP4/4 in its 1988 livery" loading="lazy" />
                  <figcaption>McLaren MP4/4 — 15 wins from 16 starts in 1988, the benchmark for every era since.</figcaption>
                </figure>
              }
              <dl class="infobox__list">
                <div><dt>Seasons covered</dt><dd class="tabular">2000–{{ year }}</dd></div>
                <div><dt>Completed championships</dt><dd class="tabular">{{ champions().length }}</dd></div>
                <div><dt>Drivers in scope</dt><dd class="tabular">{{ drivers().length }}</dd></div>
                <div><dt>Grands prix</dt><dd class="tabular">{{ races().length }}</dd></div>
                <div><dt>Most titles</dt><dd>{{ mostTitles() }}</dd></div>
              </dl>
            </aside>
          </section>

          <!-- ---------------------------------------------------------- contents -->
          <nav class="contents" aria-label="Contents">
            <h2>Contents</h2>
            <ol>
              <li><a href="#eras">1&nbsp; Eras</a></li>
              <li><a href="#rivalries">2&nbsp; Legendary rivalries</a></li>
              <li><a href="#champions">3&nbsp; Champions</a></li>
              <li><a href="#records">4&nbsp; Records</a></li>
              <li><a href="#reading">5&nbsp; Further reading</a></li>
            </ol>
          </nav>

          <!-- -------------------------------------------------------------- eras -->
          <section class="wiki-section" id="eras">
            <h2 class="wiki-heading">Eras</h2>

            @for (era of eras(); track era.id; let i = $index) {
              <section class="era" [id]="era.id">
                <header class="era__head">
                  <span class="era__range tabular">{{ era.startYear }}–{{ era.endYear }}</span>
                  <h3>{{ i + 1 }}. {{ era.title }}</h3>
                </header>

                <div class="era__grid">
                  <div class="era__text prose">
                    <p class="era__lead">{{ era.lead }}</p>
                    <p>{{ era.body }}</p>

                    <dl class="era__facts">
                      <div><dt>Rounds</dt><dd class="tabular">{{ era.races }}</dd></div>
                      <div><dt>Champions</dt><dd class="tabular">{{ era.champions.length }}</dd></div>
                      <div>
                        <dt>Most titles</dt>
                        <dd>{{ era.titleLeaders[0]?.name ?? '—' }} ({{ era.titleLeaders[0]?.titles ?? 0 }})</dd>
                      </div>
                    </dl>
                  </div>

                  <div class="era__champions">
                    @for (champ of era.champions; track champ.year) {
                      <a
                        class="champ-chip"
                        routerLink="/standings"
                        [queryParams]="{ year: champ.year }"
                        [style.--chip-color]="champ.teamColor"
                      >
                        <span class="champ-chip__year tabular">{{ champ.year }}</span>
                        <span class="champ-chip__name">{{ champ.driver?.surname ?? '—' }}</span>
                        <span class="champ-chip__team">{{ champ.constructor?.name ?? '—' }}</span>
                      </a>
                    }
                    @if (!era.champions.length) {
                      <p class="era__pending">Season in progress — no champion yet.</p>
                    }
                  </div>
                </div>

                @if (era.photo) {
                  <figure class="era__figure">
                    @if (photoUrl(era.photo.key); as src) {
                      <img [src]="src" [alt]="era.photo.caption" loading="lazy" />
                    }
                    <figcaption>{{ era.photo.caption }}</figcaption>
                  </figure>
                }
              </section>
            }
          </section>

          <!-- --------------------------------------------------------- rivalries -->
          <section class="wiki-section" id="rivalries">
            <h2 class="wiki-heading">Legendary rivalries</h2>
            <p class="section-lede">
              The sport's defining duels were rarely about a single season. These four pairs set
              the template: contrasting personalities, machinery at its limit, and championships
              decided by a handful of points.
            </p>

            <div class="rivalry-list">
              @for (rivalry of rivalries(); track rivalry.id) {
                <article class="rivalry">
                  <figure class="rivalry__figure">
                    @if (photoUrl(rivalry.photo); as src) {
                      <img [src]="src" [alt]="rivalry.caption" loading="lazy" />
                    }
                    <figcaption>{{ rivalry.caption }}</figcaption>
                  </figure>
                  <div class="rivalry__body">
                    <span class="eyebrow">{{ rivalry.years }}</span>
                    <h3>{{ rivalry.title }}</h3>
                    <p class="prose">{{ rivalry.text }}</p>
                    @if (rivalry.driver1Id && rivalry.driver2Id) {
                      <a
                        class="btn btn--sm"
                        routerLink="/rivalry"
                        [queryParams]="{ d1: rivalry.driver1Id, d2: rivalry.driver2Id }"
                      >
                        Compare {{ rivalry.names }}
                      </a>
                    }
                  </div>
                </article>
              }
            </div>
          </section>

          <!-- --------------------------------------------------------- champions -->
          <section class="wiki-section" id="champions">
            <h2 class="wiki-heading">Champions</h2>
            <p class="section-lede">
              Every completed drivers' championship since 2000. The current season is listed only
              once it is decided.
            </p>

            <div class="panel champions-table">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Driver</th>
                    <th scope="col">Constructor</th>
                    <th scope="col" class="num">Points</th>
                    <th scope="col" class="num">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  @for (champ of championsDesc(); track champ.year) {
                    <tr>
                      <td class="tabular">{{ champ.year }}</td>
                      <td>
                        <a class="driver-cell" routerLink="/standings" [queryParams]="{ year: champ.year }">
                          <app-driver-avatar
                            [forename]="champ.driver?.forename ?? ''"
                            [surname]="champ.driver?.surname ?? ''"
                            [driverRef]="champ.driver?.driverRef ?? ''"
                            [color]="champ.teamColor"
                            size="xs"
                          />
                          {{ champ.driver?.forename }} {{ champ.driver?.surname }}
                        </a>
                      </td>
                      <td>
                        <app-team-badge
                          [name]="champ.constructor?.name ?? ''"
                          [teamRef]="champ.constructor?.constructorRef ?? ''"
                          [color]="champ.teamColor"
                        />
                      </td>
                      <td class="num tabular">{{ champ.points }}</td>
                      <td class="num tabular">{{ champ.wins }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <p class="footnote">
              The {{ year }} championship is in progress. Standings and the current leader are
              available on the <a routerLink="/standings">standings page</a>.
            </p>
          </section>

          <!-- ----------------------------------------------------------- records -->
          <section class="wiki-section" id="records">
            <h2 class="wiki-heading">Records since 2000</h2>
            <div class="record-grid">
              @for (record of recordRows(); track record.label) {
                <div class="record">
                  <span class="record__label">{{ record.label }}</span>
                  <span class="record__value display tabular">{{ record.value }}</span>
                  @if (record.holder; as holder) {
                    <a class="record__who" routerLink="/drivers" [queryParams]="{ driver: holder.driverId }">
                      <app-driver-avatar
                        [forename]="holder.forename"
                        [surname]="holder.surname"
                        [driverRef]="holder.driverRef"
                        [color]="holder.teamColor"
                        size="xs"
                      />
                      {{ holder.forename }} {{ holder.surname }}
                    </a>
                  }
                </div>
              }
            </div>
          </section>

          <!-- ----------------------------------------------------------- reading -->
          <section class="wiki-section" id="reading">
            <h2 class="wiki-heading">Further reading</h2>
            <ul class="reading-list">
              <li>
                <a routerLink="/standings">Season standings</a> — every championship table from 2000
                to {{ year }}.
              </li>
              <li>
                <a routerLink="/drivers">Driver careers</a> — wins, poles, podiums and title years
                for all {{ drivers().length }} drivers in the archive.
              </li>
              <li>
                <a routerLink="/constructors">Constructors</a> — the teams, their marks and their
                championship pedigree.
              </li>
              <li><a routerLink="/rivalry">Rivalry explorer</a> — compare any two careers side by side.</li>
              <li><a routerLink="/credits">Image credits</a> — sources and licences for the photographs above.</li>
            </ul>
          </section>
        }
      </article>
    </div>
  `,
  styles: [
    `
      .history {
        max-width: 1120px;
      }

      /* --------------------------------------------------------------- masthead */
      .masthead {
        padding-bottom: 1.25rem;
        border-bottom: 3px solid var(--text);
        margin-bottom: 1.5rem;
      }

      .masthead h1 {
        margin: 0.5rem 0 0.6rem;
        font-size: clamp(2.2rem, 5vw, 3.4rem);
        letter-spacing: -0.03em;
      }

      .masthead__standfirst {
        max-width: 74ch;
        font-family: var(--font-serif);
        font-size: clamp(1.02rem, 1.5vw, 1.14rem);
        line-height: 1.62;
        color: var(--text-2);
      }

      .masthead__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.9rem;
        font-size: 0.72rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      /* ------------------------------------------------------------------- lead */
      .lead {
        display: grid;
        grid-template-columns: minmax(0, 1.62fr) minmax(0, 1fr);
        gap: clamp(1.5rem, 3.5vw, 2.75rem);
        margin-bottom: 1.5rem;
      }

      .lead__body {
        font-size: 1.0625rem;
      }

      .infobox {
        align-self: start;
        padding: 0.9rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--r-xs);
      }

      .infobox h2 {
        padding-bottom: 0.45rem;
        margin-bottom: 0.6rem;
        border-bottom: 1px solid var(--border);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .infobox__figure {
        margin-bottom: 0.75rem;
      }

      .infobox__figure img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border: 1px solid var(--border);
        background: var(--surface-3);
        filter: saturate(0.9);
      }

      .infobox__figure figcaption {
        margin-top: 0.35rem;
        font-family: var(--font-serif);
        font-size: 0.72rem;
        line-height: 1.45;
        color: var(--text-3);
      }

      .infobox__list {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.78rem;
      }

      .infobox__list > div {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.28rem 0;
        border-bottom: 1px solid var(--divider);
      }

      .infobox__list > div:last-child {
        border-bottom: 0;
      }

      .infobox__list dt {
        color: var(--text-3);
      }

      .infobox__list dd {
        font-weight: 600;
        text-align: right;
      }

      /* --------------------------------------------------------------- contents */
      .contents {
        display: inline-block;
        min-width: 260px;
        padding: 0.9rem 1.2rem 0.9rem 1rem;
        margin-bottom: 2rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--r-xs);
      }

      .contents h2 {
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
        margin-bottom: 0.4rem;
      }

      .contents ol {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.85rem;
      }

      .contents a {
        color: var(--text-2);
      }

      .contents a:hover {
        color: var(--accent);
      }

      /* ----------------------------------------------------------- wiki rhythm */
      .wiki-section {
        margin-bottom: clamp(2.5rem, 5vw, 3.75rem);
        scroll-margin-top: calc(var(--nav-h) + 1.5rem);
      }

      .wiki-heading {
        padding-bottom: 0.4rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--border-strong);
        font-family: var(--font-serif);
        font-size: clamp(1.45rem, 2.8vw, 1.85rem);
        font-weight: 600;
        letter-spacing: -0.015em;
      }

      .section-lede {
        max-width: 72ch;
        margin-bottom: 1.25rem;
        font-family: var(--font-serif);
        font-size: 1rem;
        line-height: 1.65;
        color: var(--text-2);
      }

      /* ------------------------------------------------------------------- era */
      .era {
        padding: 1.4rem 0 1.6rem;
        border-bottom: 1px solid var(--divider);
        scroll-margin-top: calc(var(--nav-h) + 1.25rem);
      }

      .era:last-child {
        border-bottom: 0;
      }

      .era__head {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.7rem;
      }

      .era__range {
        padding: 0.12rem 0.4rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--r-xs);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--text-2);
      }

      .era__head h3 {
        font-family: var(--font-serif);
        font-size: clamp(1.15rem, 2.2vw, 1.4rem);
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .era__grid {
        display: grid;
        grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
        gap: clamp(1.25rem, 3vw, 2.25rem);
        align-items: start;
      }

      .era__lead {
        font-size: 1.05rem;
        color: var(--text);
      }

      .era__text p + p {
        margin-top: 0.65rem;
      }

      .era__facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 0.9rem;
        padding-top: 0.8rem;
        border-top: 1px solid var(--divider);
      }

      .era__facts dt {
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .era__facts dd {
        margin-top: 0.15rem;
        font-size: 0.88rem;
        font-weight: 600;
      }

      .era__champions {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .champ-chip {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr);
        grid-template-areas:
          'year name'
          'year team';
        column-gap: 0.5rem;
        padding: 0.4rem 0.55rem;
        border-left: 2px solid var(--chip-color, var(--border));
        background: var(--surface-2);
        color: var(--text);
        transition: background var(--dur-fast) var(--ease);
      }

      .champ-chip:hover {
        background: var(--surface-3);
        color: var(--text);
      }

      .champ-chip__year {
        grid-area: year;
        align-self: center;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--text-3);
      }

      .champ-chip__name {
        grid-area: name;
        font-size: 0.82rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .champ-chip__team {
        grid-area: team;
        font-size: 0.68rem;
        color: var(--text-3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .era__pending {
        font-size: 0.8rem;
        color: var(--text-3);
      }

      .era__figure {
        margin-top: 1rem;
        max-width: 520px;
      }

      .era__figure img {
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border: 1px solid var(--border);
        background: var(--surface-3);
        filter: saturate(0.85);
      }

      .era__figure figcaption {
        margin-top: 0.35rem;
        font-family: var(--font-serif);
        font-size: 0.74rem;
        line-height: 1.45;
        color: var(--text-3);
      }

      /* --------------------------------------------------------------- rivalry */
      .rivalry-list {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .rivalry {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.35fr);
        gap: clamp(1rem, 2.6vw, 1.9rem);
        padding-bottom: 1.25rem;
        border-bottom: 1px solid var(--divider);
        align-items: start;
      }

      .rivalry:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .rivalry__figure img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border: 1px solid var(--border);
        background: var(--surface-3);
        filter: grayscale(0.55) contrast(1.05);
      }

      .rivalry__figure figcaption {
        margin-top: 0.35rem;
        font-family: var(--font-serif);
        font-size: 0.72rem;
        line-height: 1.45;
        color: var(--text-3);
      }

      .rivalry__body h3 {
        margin: 0.25rem 0 0.5rem;
        font-family: var(--font-serif);
        font-size: clamp(1.15rem, 2.2vw, 1.4rem);
        font-weight: 600;
      }

      .rivalry__body p {
        margin-bottom: 0.8rem;
        font-size: 0.98rem;
      }

      /* ------------------------------------------------------------- champions */
      .champions-table {
        overflow-x: auto;
      }

      .driver-cell {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
      }

      .footnote {
        margin-top: 0.75rem;
        font-family: var(--font-serif);
        font-size: 0.82rem;
        color: var(--text-3);
      }

      .footnote a {
        color: var(--text-2);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      /* --------------------------------------------------------------- records */
      .record-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0;
        border: 1px solid var(--border);
        border-radius: var(--r-xs);
        overflow: hidden;
        background: var(--surface);
      }

      .record {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 1rem 1.1rem;
        border-right: 1px solid var(--divider);
        border-bottom: 1px solid var(--divider);
      }

      .record:nth-child(3n) {
        border-right: 0;
      }

      .record:nth-last-child(-n + 3) {
        border-bottom: 0;
      }

      .record__label {
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .record__value {
        font-size: 1.75rem;
      }

      .record__who {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--text-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* --------------------------------------------------------------- reading */
      .reading-list {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-family: var(--font-serif);
        font-size: 0.98rem;
        color: var(--text-2);
      }

      .reading-list a {
        color: var(--text);
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-color: var(--silver-4);
      }

      /* ------------------------------------------------------------ responsive */
      @media (max-width: 900px) {
        .lead,
        .era__grid,
        .rivalry {
          grid-template-columns: 1fr;
        }

        .infobox {
          max-width: 420px;
        }

        .rivalry__figure {
          max-width: 420px;
        }
      }

      @media (max-width: 620px) {
        .record-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .record:nth-child(3n) {
          border-right: 1px solid var(--divider);
        }

        .record:nth-child(2n) {
          border-right: 0;
        }

        .record:nth-last-child(-n + 3) {
          border-bottom: 1px solid var(--divider);
        }

        .record:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .era__facts {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class HistoryComponent implements OnInit {
  private readonly csv = inject(CSVDataService);

  readonly year = new Date(DATA_THROUGH).getUTCFullYear();
  readonly through = new Date(DATA_THROUGH).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  readonly loading = signal(true);
  readonly drivers = signal<DriverCareer[]>([]);
  readonly champions = signal<ChampionRow[]>([]);
  readonly races = signal<Race[]>([]);

  readonly mp4 = computed(() => photo('mp4-4'));

  readonly championsDesc = computed(() =>
    this.champions().slice().sort((a, b) => b.year - a.year),
  );

  readonly mostTitles = computed(() => {
    const counts = new Map<string, { name: string; titles: number }>();
    for (const champ of this.champions()) {
      if (!champ.driver) continue;
      const key = champ.driver.driverRef;
      const entry = counts.get(key) ?? {
        name: `${champ.driver.forename} ${champ.driver.surname}`,
        titles: 0,
      };
      entry.titles += 1;
      counts.set(key, entry);
    }
    const top = [...counts.values()].sort((a, b) => b.titles - a.titles)[0];
    return top ? `${top.name} (${top.titles})` : '—';
  });

  private readonly definitions: EraDefinition[] = [
    {
      id: 'era-ferrari',
      startYear: 2000,
      endYear: 2004,
      title: 'Ferrari’s crimson dynasty',
      lead:
        'Five consecutive drivers’ titles, four constructors’ crowns, and a German who made winning look routine.',
      body:
        'Michael Schumacher joined Ferrari in 1996 and, with Ross Brawn and Jean Todt, turned the team into a machine. Between 2000 and 2004 he won 48 of 85 races, with Rubens Barrichello sweeping up podiums behind him. The run ended with a sixth straight constructors’ title in 2004 — a benchmark no team has matched since.',
      photo: { key: 'schumacher-2005', caption: 'Michael Schumacher at Ferrari, the defining driver of the early 2000s.' },
    },
    {
      id: 'era-v10',
      startYear: 2005,
      endYear: 2008,
      title: 'The end of the V10 age',
      lead:
        'Renault break Ferrari’s grip, a 22-year-old arrives, and the sport says goodbye to refuelling and V10 engines.',
      body:
        'Fernando Alonso and Renault ended the Ferrari run in 2005–06 with a blend of reliability and Michelin rubber. Kimi Räikkönen took a dramatic 2007 title for Ferrari, then Lewis Hamilton won his first championship in the final corner of 2008. The 2009 rule book — slick tyres, KERS and radically reduced aero — would rewrite everything.',
    },
    {
      id: 'era-brawn',
      startYear: 2009,
      endYear: 2013,
      title: 'Brawn, Red Bull and Vettel',
      lead:
        'A team bought for one pound wins a double, then a young German rattles off four championships in a row.',
      body:
        'Brawn GP’s 2009 double remains the sport’s great fairytale: Honda withdrew, Ross Brawn rescued the operation, and Jenson Button won six of the first seven races. Red Bull and Sebastian Vettel then redefined aerodynamic efficiency, winning nine consecutive races in 2013 on the way to a fourth straight title.',
    },
    {
      id: 'era-hybrid',
      startYear: 2014,
      endYear: 2020,
      title: 'The hybrid Mercedes era',
      lead:
        'Eight consecutive constructors’ titles, six drivers’ crowns for Hamilton, and one for Rosberg.',
      body:
        'The 1.6-litre turbo-hybrid regulations handed Mercedes a decisive power-unit advantage. Lewis Hamilton and Nico Rosberg turned it into an internal war, Rosberg taking 2016 before retiring. Hamilton then reeled off four more titles, equalling Schumacher’s seven, while Ferrari and Red Bull traded occasional blows without sustaining a challenge.',
    },
    {
      id: 'era-groundeffect',
      startYear: 2021,
      endYear: 2026,
      title: 'Ground effect and a new generation',
      lead:
        'Abu Dhabi 2021, the ground-effect reset, Verstappen’s four-year reign, and McLaren’s return to the front.',
      body:
        'The 2021 title fight went to the last lap of the last race. New ground-effect cars arrived in 2022 and Red Bull adapted fastest — Verstappen won 15 races in 2023 and a fourth straight title in 2024. McLaren answered in 2025 with Lando Norris’s first championship, and the sweeping 2026 regulations have opened the field again: Andrea Kimi Antonelli leads a Mercedes resurgence with the season still running.',
      photo: { key: 'senna-mclaren', caption: 'McLaren’s lineage runs from Senna’s MP4/5 to the title-winning cars of the 2020s.' },
    },
  ];

  readonly eras = computed<Era[]>(() => {
    const champions = this.champions();
    const races = this.races();
    return this.definitions.map((definition) => {
      const eraChampions = champions
        .filter((champ) => champ.year >= definition.startYear && champ.year <= definition.endYear)
        .sort((a, b) => a.year - b.year);

      const counts = new Map<string, { name: string; titles: number }>();
      for (const champ of eraChampions) {
        if (!champ.driver) continue;
        const key = champ.driver.driverRef;
        const entry = counts.get(key) ?? {
          name: champ.driver.surname,
          titles: 0,
        };
        entry.titles += 1;
        counts.set(key, entry);
      }

      return {
        ...definition,
        champions: eraChampions,
        races: races.filter(
          (race) => race.year >= definition.startYear && race.year <= definition.endYear,
        ).length,
        titleLeaders: [...counts.values()].sort((a, b) => b.titles - a.titles),
      };
    });
  });

  readonly rivalries = computed<Rivalry[]>(() => {
    const find = (ref: string) => this.drivers().find((driver) => driver.driverRef === ref) ?? null;
    const pairs = [
      {
        id: 'hunt-lauda',
        title: 'Hunt vs Lauda',
        years: '1976',
        photoKey: 'hunt-lauda',
        caption: 'James Hunt and Niki Lauda, 1976 — a title decided in the Fuji rain.',
        text:
          'James Hunt and Niki Lauda were opposites in everything but ambition. Lauda led the 1976 championship until his near-fatal crash at the Nürburgring; six weeks later he was racing again. Hunt clawed the points back and won the title in torrential rain at Fuji when Lauda, reasoning the risk was not worth it, withdrew. Their rivalry gave the sport its first truly global television drama.',
        refs: ['hunt', 'lauda'],
        names: 'Hunt and Lauda',
      },
      {
        id: 'lauda-prost',
        title: 'Lauda vs Prost',
        years: '1984–1985',
        photoKey: 'lauda-1982',
        caption: 'Niki Lauda, the old master who beat a faster team-mate on judgement.',
        text:
          'McLaren paired the retiring Niki Lauda with Alain Prost, ten years his junior and quicker over a single lap. Lauda won the 1984 title by half a point — the smallest margin in history — by finishing races Prost did not. It was a lesson in consistency that Prost would later turn into an art form of his own.',
        refs: ['lauda', 'prost'],
        names: 'Lauda and Prost',
      },
      {
        id: 'senna-prost',
        title: 'Senna vs Prost',
        years: '1988–1990',
        photoKey: 'senna-1988',
        caption: 'Ayrton Senna at McLaren, the era’s most complete qualifying driver.',
        text:
          'Team-mates at McLaren, then enemies across the pit lane. Ayrton Senna and Alain Prost split the 1988 and 1989 titles before their collision at Suzuka in 1989 handed Prost the championship. A year later Senna returned the favour at the same corner, taking the title on the first lap. No rivalry has carried more political weight — or more consequence.',
        refs: ['senna', 'prost'],
        names: 'Senna and Prost',
      },
      {
        id: 'senna-mansell',
        title: 'Senna vs Mansell',
        years: '1991–1992',
        photoKey: 'senna-montreal',
        caption: 'Senna and Mansell wheel-to-wheel — the duel that filled the early 1990s.',
        text:
          'Nigel Mansell’s flat-out style against Senna’s precision produced some of the era’s most aggressive racing, from Barcelona’s slipstream battle in 1991 to their wheel-to-wheel exchanges in 1992. Mansell took the 1992 title in dominant fashion; the pair’s mutual respect was built on the knowledge that neither would lift.',
        refs: ['senna', 'mansell'],
        names: 'Senna and Mansell',
      },
    ];

    return pairs.map((pair) => {
      const driver1 = find(pair.refs[0]);
      const driver2 = find(pair.refs[1]);
      return {
        id: pair.id,
        title: pair.title,
        years: pair.years,
        photo: pair.photoKey,
        caption: pair.caption,
        text: pair.text,
        driver1Id: driver1?.driverId ?? null,
        driver2Id: driver2?.driverId ?? null,
        names: pair.names,
      } satisfies Rivalry;
    });
  });

  readonly recordRows = computed<RecordRow[]>(() => {
    const drivers = this.drivers();
    const best = (value: (driver: DriverCareer) => number) =>
      drivers.slice().sort((a, b) => value(b) - value(a))[0] ?? null;
    const entries: { label: string; value: (driver: DriverCareer) => number }[] = [
      { label: 'World titles', value: (driver) => driver.championships },
      { label: 'Race wins', value: (driver) => driver.wins },
      { label: 'Podiums', value: (driver) => driver.podiums },
      { label: 'Pole positions', value: (driver) => driver.poles },
      { label: 'Race starts', value: (driver) => driver.starts },
      { label: 'Career points', value: (driver) => driver.points },
    ];

    return entries.map((entry) => {
      const holder = best(entry.value);
      return {
        label: entry.label,
        value: holder ? String(Math.round(entry.value(holder))) : '—',
        holder,
      };
    });
  });

  ngOnInit(): void {
    forkJoin({
      drivers: this.csv.getDrivers(),
      champions: this.csv.getChampions(),
      races: this.csv.getRaces(),
    }).subscribe(({ drivers, champions, races }) => {
      this.drivers.set(drivers);
      this.champions.set(champions);
      this.races.set(races);
      this.loading.set(false);
    });
  }

  photoUrl(key: string): string | null {
    return photo(key);
  }
}
