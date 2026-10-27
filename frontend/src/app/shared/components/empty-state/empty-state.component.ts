import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty">
      <span class="empty__icon" aria-hidden="true">{{ icon() }}</span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (actionLabel() && actionLink()) {
        <a class="btn btn--sm" [routerLink]="actionLink()">{{ actionLabel() }}</a>
      }
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: clamp(2.25rem, 6vw, 3.5rem) 1.5rem;
        text-align: center;
        background: var(--surface);
        border: 1px dashed var(--border-strong);
        border-radius: var(--r-md);
      }

      .empty__icon {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        margin-bottom: 0.25rem;
        border-radius: var(--r-sm);
        background: var(--surface-2);
        border: 1px solid var(--border);
        font-size: 1.15rem;
      }

      h3 {
        font-size: 1.05rem;
      }

      p {
        max-width: 46ch;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input('🏁');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly actionLabel = input('');
  readonly actionLink = input<string | unknown[]>();
}
