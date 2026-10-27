import { Component, computed, input } from '@angular/core';

/**
 * A single figure with a small uppercase label. Flat, hairline-ruled, no glow —
 * the number does the work.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  template: `
    <div class="tile">
      <span class="tile__label">{{ label() }}</span>
      <span class="tile__value display tabular">
        {{ value() }}
        @if (suffix()) {
          <span class="tile__suffix">{{ suffix() }}</span>
        }
      </span>
      @if (hint()) {
        <span class="tile__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .tile {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 0;
        padding: 1rem 1.1rem;
        border-left: 1px solid var(--divider);
      }

      .tile__label {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-3);
      }

      .tile__value {
        display: flex;
        align-items: baseline;
        gap: 0.3rem;
        font-size: clamp(1.6rem, 3vw, 2.15rem);
        color: var(--text);
      }

      .tile__suffix {
        font-family: var(--font-ui);
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-3);
        letter-spacing: 0;
      }

      .tile__hint {
        font-size: 0.78rem;
        color: var(--text-3);
      }
    `,
  ],
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number>('—');
  readonly suffix = input('');
  readonly hint = input('');
  readonly icon = input('');
  readonly accent = input('');
  readonly decimals = input(0);

  readonly numericValue = computed(() => {
    const value = this.value();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    return null;
  });
}
