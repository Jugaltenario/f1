import { Component, computed, input, signal } from '@angular/core';
import { TEAM_LOGOS } from '../../../core/config/asset-manifest';

/**
 * Team mark + name. Uses the locally cached logo when one exists; historic
 * teams without a licensable mark (or any image that fails to load) fall back
 * to a typographic crest rather than a broken image.
 */
@Component({
  selector: 'app-team-badge',
  standalone: true,
  template: `
    <span class="team-badge" [class.team-badge--compact]="compact()" [style.--team-color]="color()">
      @if (logo() && !broken()) {
        <span class="team-badge__logo">
          <img
            [src]="'/assets/images/teams/' + logo()"
            [alt]="name()"
            loading="lazy"
            decoding="async"
            (error)="broken.set(true)"
          />
        </span>
      } @else {
        <span class="team-badge__crest" aria-hidden="true">{{ crest() }}</span>
      }
      @if (!compact() || !logo() || broken()) {
        <span class="team-badge__name">{{ name() || '—' }}</span>
      }
    </span>
  `,
  styles: [
    `
      .team-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
        font-size: 0.84rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .team-badge--compact {
        gap: 0.35rem;
      }

      .team-badge__logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 26px;
        height: 18px;
        padding: 1px;
      }

      .team-badge__logo img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        filter: grayscale(1) contrast(1.1);
        opacity: 0.85;
      }

      .team-badge__crest {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 21px;
        height: 21px;
        border-radius: var(--r-xs);
        background: var(--surface-3);
        border: 1px solid var(--border);
        border-left: 2px solid var(--team-color, var(--border-strong));
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: var(--text-2);
      }

      .team-badge__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class TeamBadgeComponent {
  readonly name = input('');
  readonly teamRef = input('');
  readonly color = input('#8b9298');
  readonly compact = input(false);

  readonly broken = signal(false);
  readonly logo = computed(() => TEAM_LOGOS[this.teamRef()] ?? null);
  readonly crest = computed(() => {
    const words = this.name().replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return '—';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  });
}
