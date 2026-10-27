import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  template: `
    @for (row of rows(); track row) {
      <div
        class="skeleton skeleton__row"
        [style.height.px]="height()"
        [style.border-radius]="circle() ? '999px' : null"
      ></div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .skeleton__row {
        width: 100%;
      }
    `,
  ],
})
export class SkeletonLoaderComponent {
  readonly count = input(4);
  readonly height = input(72);
  readonly circle = input(false);

  rows(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
