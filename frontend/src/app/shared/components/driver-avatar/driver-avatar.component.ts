import { Component, computed, input, signal } from '@angular/core';
import { DRIVER_PHOTOS } from '../../../core/config/asset-manifest';
import { initials } from '../../../core/utils/format';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Square driver portrait with a hairline frame. Drivers outside the OpenF1
 * window (or without a cached file) get a monogram on a neutral silver field.
 */
@Component({
  selector: 'app-driver-avatar',
  standalone: true,
  template: `
    <div
      [class]="'avatar avatar--' + size()"
      [style.--avatar-color]="color() || '#8b9298'"
      [attr.aria-label]="label()"
      role="img"
    >
      @if (hasPhoto() && !broken()) {
        <img
          [src]="'/assets/images/drivers/' + driverRef() + '.png'"
          [alt]="label()"
          loading="lazy"
          decoding="async"
          (error)="broken.set(true)"
        />
      } @else {
        <span class="avatar__monogram">{{ monogram() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .avatar {
        --avatar-size: 44px;

        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: var(--avatar-size);
        height: var(--avatar-size);
        overflow: hidden;
        border-radius: var(--r-xs);
        background: var(--surface-3);
        border: 1px solid var(--border);
        border-bottom: 2px solid var(--avatar-color);
        color: var(--text-3);
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        filter: saturate(0.9);
      }

      .avatar__monogram {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: calc(var(--avatar-size) * 0.3);
        letter-spacing: 0.04em;
        color: var(--text-3);
      }

      .avatar--xs {
        --avatar-size: 24px;
      }

      .avatar--sm {
        --avatar-size: 34px;
      }

      .avatar--md {
        --avatar-size: 44px;
      }

      .avatar--lg {
        --avatar-size: 60px;
      }

      .avatar--xl {
        --avatar-size: clamp(80px, 11vw, 112px);
      }
    `,
  ],
})
export class DriverAvatarComponent {
  readonly forename = input('');
  readonly surname = input('');
  readonly driverRef = input('');
  readonly color = input('');
  readonly size = input<AvatarSize>('md');

  readonly broken = signal(false);

  readonly label = computed(() => `${this.forename()} ${this.surname()}`.trim());
  readonly monogram = computed(() => initials(this.forename(), this.surname()));
  readonly hasPhoto = computed(() => !!this.driverRef() && DRIVER_PHOTOS.has(this.driverRef()));
}
