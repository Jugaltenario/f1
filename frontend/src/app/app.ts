import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { TrackBackgroundComponent } from './shared/components/track-background/track-background.component';
import { DATA_THROUGH } from './core/config/data.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NavbarComponent, TrackBackgroundComponent],
  template: `
    <a class="skip-link" href="#content">Skip to content</a>

    <app-track-background></app-track-background>

    <app-navbar></app-navbar>

    <main id="content" tabindex="-1">
      <router-outlet></router-outlet>
    </main>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <strong>Paddock</strong>
          <span>Formula 1 archive · Angular 21</span>
        </div>

        <nav class="site-footer__links" aria-label="Footer">
          <a routerLink="/history">History</a>
          <a routerLink="/rivalry">Rivalry</a>
          <a routerLink="/credits">Credits</a>
          <a href="https://www.formula1.com" target="_blank" rel="noopener">Formula1.com</a>
          <a href="https://openf1.org" target="_blank" rel="noopener">OpenF1</a>
        </nav>

        <p class="site-footer__note">
          Archive 2000–{{ year }} · last reconciled {{ through }} · live timing and telemetry 2023+ via OpenF1.
          Unofficial fan project; not affiliated with Formula 1. Team marks and photography belong to their owners —
          see <a routerLink="/credits">credits</a>.
        </p>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        color: var(--text);
      }

      main {
        flex: 1 0 auto;
        min-height: 100vh;
        outline: none;
      }

      .skip-link {
        position: fixed;
        top: 0.6rem;
        left: 50%;
        translate: -50% -200%;
        z-index: var(--z-overlay);
        padding: 0.5rem 0.9rem;
        border-radius: var(--r-xs);
        background: var(--accent);
        color: #fff;
        font-size: 0.8rem;
        font-weight: 600;
        transition: translate var(--dur) var(--ease-out);
      }

      .skip-link:focus-visible {
        translate: -50% 0;
      }

      .site-footer {
        position: relative;
        border-top: 1px solid var(--border);
        background: var(--surface);
        padding: 2rem var(--page-pad) 1.75rem;
      }

      .site-footer__inner {
        max-width: var(--page-max);
        margin: 0 auto;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.9rem 2rem;
        justify-content: space-between;
      }

      .site-footer__brand {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
      }

      .site-footer__brand strong {
        font-family: var(--font-display);
        font-size: 0.92rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .site-footer__brand span {
        font-size: 0.72rem;
        color: var(--text-3);
      }

      .site-footer__links {
        display: flex;
        gap: 1.1rem;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .site-footer__links a {
        color: var(--text-2);
      }

      .site-footer__links a:hover {
        color: var(--accent);
      }

      .site-footer__note {
        flex-basis: 100%;
        padding-top: 0.9rem;
        border-top: 1px solid var(--divider);
        font-size: 0.72rem;
        line-height: 1.6;
        color: var(--text-3);
      }

      .site-footer__note a {
        color: var(--text-2);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      @media (max-width: 640px) {
        .site-footer__inner {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class App {
  readonly year = new Date(DATA_THROUGH).getUTCFullYear();
  readonly through = new Date(DATA_THROUGH).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
