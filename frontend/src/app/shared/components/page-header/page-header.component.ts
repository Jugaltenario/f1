import { Component, input } from '@angular/core';

/**
 * Editorial page masthead: a small uppercase kicker, a tight headline, an
 * optional standfirst, and a hairline rule that separates it from the content.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-head">
      <div class="page-head__copy">
        @if (eyebrow()) {
          <span class="eyebrow">{{ eyebrow() }}</span>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-head__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-head__actions">
        <ng-content></ng-content>
      </div>
    </header>
  `,
  styles: [
    `
      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1.5rem;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
        padding-bottom: 1.1rem;
        border-bottom: 1px solid var(--border);
        animation: riseIn var(--dur-slow) var(--ease-out) both;
      }

      .page-head__copy {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        max-width: 66ch;
      }

      h1 {
        font-size: clamp(1.9rem, 4.4vw, 2.9rem);
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--text);
      }

      .page-head__subtitle {
        font-family: var(--font-serif);
        font-size: clamp(0.98rem, 1.4vw, 1.08rem);
        line-height: 1.55;
        color: var(--text-2);
        max-width: 62ch;
      }

      .page-head__actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      @media (max-width: 640px) {
        .page-head {
          align-items: flex-start;
        }

        .page-head__actions {
          width: 100%;
        }
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
