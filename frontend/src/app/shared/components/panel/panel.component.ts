import { Component, input } from '@angular/core';

export type PanelVariant = 'default' | 'inset' | 'flush' | 'plain' | 'accent';

/**
 * Base surface for the app: a flat matte panel with a hairline border and one
 * soft shadow. `interactive` adds the underline-on-hover used by cards that
 * behave like links; `accent` draws a 2px team-colour rule along the top edge.
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  template: `
    <div
      class="panel"
      [class.panel--inset]="variant() === 'inset'"
      [class.panel--flush]="variant() === 'flush'"
      [class.panel--plain]="variant() === 'plain'"
      [class.panel--accent]="variant() === 'accent'"
      [class.panel--interactive]="interactive()"
      [style.--panel-accent]="accent() || null"
    >
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .panel {
        position: relative;
        height: 100%;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-sm);
        transition:
          border-color var(--dur) var(--ease),
          box-shadow var(--dur) var(--ease),
          background var(--dur) var(--ease);
      }

      .panel--inset {
        background: var(--surface-2);
        box-shadow: none;
      }

      .panel--flush {
        border-radius: var(--r-xs);
      }

      .panel--plain {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
      }

      .panel--accent::before {
        content: '';
        position: absolute;
        inset: 0 0 auto;
        height: 2px;
        background: var(--panel-accent, var(--accent));
        border-radius: var(--r-md) var(--r-md) 0 0;
      }

      .panel--interactive {
        cursor: pointer;
        outline: none;
      }

      .panel--interactive:hover,
      .panel--interactive:focus-visible {
        border-color: var(--border-strong);
        background: var(--surface);
        box-shadow: var(--shadow);
      }

      .panel--interactive:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class PanelComponent {
  readonly variant = input<PanelVariant>('default');
  readonly interactive = input(false);
  readonly accent = input<string>('');
}
