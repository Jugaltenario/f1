import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BRAND_LOGO } from '../../core/config/asset-manifest';
import { DATA_THROUGH } from '../../core/config/data.config';

interface NavItem {
  label: string;
  path: string;
  exact?: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="nav-shell" [class.nav-shell--scrolled]="scrolled()">
      <nav class="nav" aria-label="Main navigation">
        <a routerLink="/" class="brand" (click)="closeAll()" aria-label="Paddock home">
          <span class="brand__mark" [style.--brand-logo]="brandMask" aria-hidden="true"></span>
          <span class="brand__text">
            <span class="brand__name">PADDOCK</span>
            <span class="brand__sub">Formula 1 archive</span>
          </span>
        </a>

        <div class="nav__links">
          @for (item of primary; track item.path) {
            <a
              class="nav__link"
              [routerLink]="item.path"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            >
              {{ item.label }}
              @if (item.path === '/live') {
                <span class="nav__live-dot" aria-hidden="true"></span>
              }
            </a>
          }

          <div class="nav__more" [class.is-open]="moreOpen()">
            <button
              type="button"
              class="nav__link nav__link--button"
              [class.is-active]="moreOpen()"
              [attr.aria-expanded]="moreOpen()"
              (click)="toggleMore($event)"
            >
              Explore
              <svg viewBox="0 0 12 12" class="nav__chevron" aria-hidden="true">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </button>

            @if (moreOpen()) {
              <div class="nav__popover">
                @for (item of secondary; track item.path) {
                  <a class="nav__popover-link" [routerLink]="item.path" (click)="closeAll()">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </a>
                }
              </div>
            }
          </div>
        </div>

        <div class="nav__actions">
          <span class="nav__season tabular" title="Archive last reconciled">{{ season }}</span>
          <button
            type="button"
            class="icon-btn icon-btn--menu"
            [attr.aria-expanded]="menuOpen()"
            aria-label="Toggle menu"
            (click)="menuOpen.set(!menuOpen())"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              @if (menuOpen()) {
                <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              } @else {
                <path
                  d="M4 7h16M4 12h16M4 17h10"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              }
            </svg>
          </button>
        </div>
      </nav>

      @if (menuOpen()) {
        <div class="mobile">
          @for (item of [...primary, ...secondaryMobile]; track item.path) {
            <a
              class="mobile__link"
              [routerLink]="item.path"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              (click)="closeAll()"
            >
              <span>{{ item.label }}</span>
              <span class="mobile__arrow" aria-hidden="true">→</span>
            </a>
          }
        </div>
      }
    </header>
  `,
  styles: [
    `
      .nav-shell {
        position: fixed;
        inset: 0 0 auto;
        z-index: var(--z-nav);
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--brushed);
          border-bottom: 1px solid var(--border);
          pointer-events: none;
        }
      }

      .nav {
        position: relative;
        pointer-events: auto;
        width: 100%;
        max-width: 1440px;
        height: var(--nav-h);
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 0 var(--page-pad);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        flex: 0 0 auto;
        color: var(--text);
      }

      .brand__mark {
        display: block;
        width: 42px;
        height: 20px;
        background: var(--f1-red);
        -webkit-mask: var(--brand-logo) center / contain no-repeat;
        mask: var(--brand-logo) center / contain no-repeat;
      }

      .brand__text {
        display: flex;
        flex-direction: column;
        line-height: 1.05;
      }

      .brand__name {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 0.16em;
      }

      .brand__sub {
        font-size: 0.58rem;
        letter-spacing: 0.06em;
        color: var(--text-3);
        text-transform: uppercase;
      }

      .nav__links {
        display: flex;
        align-items: stretch;
        align-self: stretch;
        gap: 0.15rem;
        flex: 1 1 auto;
        min-width: 0;
      }

      .nav__link {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0 0.7rem;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-2);
        white-space: nowrap;
        transition: color var(--dur-fast) var(--ease);

        &::after {
          content: '';
          position: absolute;
          left: 0.7rem;
          right: 0.7rem;
          bottom: 0;
          height: 2px;
          background: transparent;
          transition: background var(--dur-fast) var(--ease);
        }

        &:hover {
          color: var(--text);
        }

        &.is-active {
          color: var(--text);

          &::after {
            background: var(--accent);
          }
        }
      }

      .nav__live-dot {
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--accent);
      }

      .nav__link--button {
        border: 0;
        background: none;
        cursor: pointer;
      }

      .nav__chevron {
        width: 10px;
        height: 10px;
        opacity: 0.6;
        transition: transform var(--dur-fast) var(--ease);
      }

      .nav__more.is-open .nav__chevron {
        transform: rotate(180deg);
      }

      .nav__more {
        position: relative;
        display: flex;
      }

      .nav__popover {
        position: absolute;
        top: calc(100% + 1px);
        right: 0;
        width: 264px;
        padding: 0.35rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        animation: fadeIn var(--dur) var(--ease) both;
      }

      .nav__popover-link {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        padding: 0.5rem 0.65rem;
        border-radius: var(--r-xs);
        color: var(--text);
        transition: background var(--dur-fast) var(--ease);
      }

      .nav__popover-link:hover {
        background: var(--surface-2);
      }

      .nav__popover-link strong {
        font-size: 0.82rem;
        font-weight: 600;
      }

      .nav__popover-link small {
        font-size: 0.72rem;
        color: var(--text-3);
      }

      .nav__actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 0 0 auto;
      }

      .nav__season {
        padding: 0.15rem 0.45rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--r-xs);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--text-2);
      }

      .icon-btn {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: var(--r-xs);
        color: var(--text-2);
        border: 1px solid transparent;
        transition:
          color var(--dur-fast) var(--ease),
          background var(--dur-fast) var(--ease),
          border-color var(--dur-fast) var(--ease);
      }

      .icon-btn:hover {
        color: var(--text);
        background: rgba(255, 255, 255, 0.5);
        border-color: var(--border);
      }

      .icon-btn svg {
        width: 18px;
        height: 18px;
      }

      .icon-btn--menu {
        display: none;
      }

      .mobile {
        pointer-events: auto;
        width: 100%;
        max-width: 1440px;
        padding: 0.4rem var(--page-pad) 0.75rem;
        background: var(--brushed);
        border-bottom: 1px solid var(--border);
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.15rem;
        animation: fadeIn var(--dur) var(--ease) both;
      }

      .mobile__link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 0.6rem;
        border-radius: var(--r-xs);
        color: var(--text-2);
        font-weight: 600;
        font-size: 0.85rem;
      }

      .mobile__link:hover,
      .mobile__link.is-active {
        color: var(--text);
        background: rgba(255, 255, 255, 0.55);
      }

      .mobile__arrow {
        color: var(--text-3);
      }

      @media (max-width: 1120px) {
        .brand__sub {
          display: none;
        }

        .nav__link {
          padding: 0 0.5rem;
          font-size: 0.78rem;
        }
      }

      @media (max-width: 940px) {
        .nav__links {
          display: none;
        }

        .icon-btn--menu {
          display: grid;
        }

        .brand {
          flex: 1 1 auto;
        }
      }

      @media (max-width: 520px) {
        .brand__name {
          font-size: 0.82rem;
        }

        .nav__season {
          display: none;
        }

        .mobile {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  readonly menuOpen = signal(false);
  readonly moreOpen = signal(false);
  readonly scrolled = signal(false);

  readonly season = String(new Date(DATA_THROUGH).getUTCFullYear());
  readonly brandMask = BRAND_LOGO
    ? `url('/assets/images/brand/${BRAND_LOGO}')`
    : 'none';

  readonly primary: NavItem[] = [
    { label: 'Home', path: '/', exact: true },
    { label: 'Standings', path: '/standings' },
    { label: 'Drivers', path: '/drivers' },
    { label: 'Teams', path: '/constructors' },
    { label: 'Circuits', path: '/circuits' },
    { label: 'Races', path: '/races' },
    { label: 'Live', path: '/live' },
  ];

  readonly secondary: (NavItem & { description: string })[] = [
    { label: 'History', path: '/history', description: 'Champions, eras and rivalries' },
    { label: 'Rivalry', path: '/rivalry', description: 'Compare two careers' },
    { label: 'Credits', path: '/credits', description: 'Image sources and licensing' },
  ];

  readonly secondaryMobile: NavItem[] = this.secondary.map(({ label, path }) => ({ label, path }));

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.moreOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.nav__more')) return;
    this.moreOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.moreOpen.set(false);
    this.menuOpen.set(false);
  }

  toggleMore(event: MouseEvent): void {
    event.stopPropagation();
    this.moreOpen.set(!this.moreOpen());
  }

  closeAll(): void {
    this.moreOpen.set(false);
    this.menuOpen.set(false);
  }
}
