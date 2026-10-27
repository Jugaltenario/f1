import { Component } from '@angular/core';
import { CIRCUIT_OUTLINES } from '../../../core/config/circuit-outlines';

interface Slot {
  left: number;
  top: number;
  size: number;
}

interface Placement {
  /** Resolved path data. */
  d: string;
  left: number;
  top: number;
  size: number;
  /** Base angle; the float animation rocks around it. */
  rotate: number;
  /** Degrees added at the midpoint of the float. */
  spin: number;
  duration: number;
  delay: number;
  dx: number;
  dy: number;
  flip?: boolean;
  /** Five-column field used between 761 and 1400 px. */
  tablet?: Slot;
  /** Two-column field used on phones. */
  mobile?: Slot;
}

/** Thirty of the generated outlines form the field; every circuit appears once. */
const CIRCUIT_IDS = [
  'monaco',
  'monza',
  'silverstone',
  'spa',
  'suzuka',
  'interlagos',
  'villeneuve',
  'albert_park',
  'red_bull_ring',
  'hockenheimring',
  'catalunya',
  'baku',
  'shanghai',
  'americas',
  'sepang',
  'hungaroring',
  'zandvoort',
  'jeddah',
  'losail',
  'imola',
  'mugello',
  'portimao',
  'paul_ricard',
  'nurburgring',
  'istanbul',
  'valencia',
  'sochi',
  'yeongam',
  'mexico',
  'las_vegas',
];

const shapeById = new Map(CIRCUIT_OUTLINES.map((outline) => [outline.id, outline.d]));

/** Stable 0–1 value so the layout is organic but identical on every load. */
function hash(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Loose slot field: items sit in the middle of a cell, then shift a little.
 * Alternating rows are offset half a cell so the columns never line up.
 */
function buildSlot(
  index: number,
  columns: number,
  rows: number,
  size: [number, number],
  offset: [number, number],
): Slot {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const stagger = row % 2 === 0 ? 0 : 0.5;
  const sizePx = size[0] + hash(index + 17) * (size[1] - size[0]);

  return {
    left: ((column + stagger + 0.5) / columns) * 100 - offset[0] + (hash(index + 3) - 0.5) * 3,
    top: ((row + 0.5) / rows) * 100 - offset[1] + (hash(index + 9) - 0.5) * 2.5,
    size: Math.round(sizePx),
  };
}

/**
 * Decorative layer: thirty distinct stroke-only circuit maps, drawn in black at
 * a uniform 20% ink, on a loose 6×5 staggered field that covers the whole
 * viewport — edges included, with no corner weighting and no vignette. Each
 * track floats a few pixels and rocks a couple of degrees on its own long loop;
 * the motion is deliberately small so the field stays composed.
 *
 * Breakpoints rebuild the field rather than cropping it: five columns at
 * 1400 px (twenty shapes) and two columns at 760 px (ten), so every size keeps
 * edge-to-edge coverage. Only thirty of the generated outlines are used, each
 * exactly once.
 */
@Component({
  selector: 'app-track-background',
  standalone: true,
  template: `
    <div class="tracks" aria-hidden="true">
      @for (item of placements; track $index) {
        <svg
          class="tracks__item"
          viewBox="0 0 100 100"
          [style.--left]="item.left + '%'"
          [style.--top]="item.top + '%'"
          [style.--size]="item.size + 'px'"
          [style.--rot]="item.rotate + 'deg'"
          [style.--spin]="item.spin + 'deg'"
          [style.--dur]="item.duration + 'ms'"
          [style.--delay]="item.delay + 'ms'"
          [style.--dx]="item.dx + 'px'"
          [style.--dy]="item.dy + 'px'"
          [style.--left-md]="(item.tablet?.left ?? item.left) + '%'"
          [style.--top-md]="(item.tablet?.top ?? item.top) + '%'"
          [style.--size-md]="(item.tablet?.size ?? item.size) + 'px'"
          [style.--left-sm]="(item.mobile?.left ?? item.left) + '%'"
          [style.--top-sm]="(item.mobile?.top ?? item.top) + '%'"
          [style.--size-sm]="(item.mobile?.size ?? item.size) + 'px'"
          [style.transform]="item.flip ? 'scaleX(-1)' : null"
        >
          <path [attr.d]="item.d" />
        </svg>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: var(--z-bg);
        pointer-events: none;
        overflow: hidden;
      }

      .tracks {
        position: absolute;
        inset: 0;
        /** Single ink control for the whole field. */
        --ink: 0.2;
        color: #0b0d0f;
      }

      .tracks__item {
        position: absolute;
        left: var(--left);
        top: var(--top);
        width: var(--size);
        height: var(--size);
        opacity: var(--ink);
        rotate: var(--rot);
        animation: trackFloat var(--dur) cubic-bezier(0.45, 0, 0.55, 1) var(--delay) infinite;
      }

      .tracks__item path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.05;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }

      @keyframes trackFloat {
        0%,
        100% {
          translate: 0 0;
          rotate: var(--rot);
        }

        50% {
          translate: var(--dx) var(--dy);
          rotate: calc(var(--rot) + var(--spin));
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .tracks__item {
          will-change: translate, rotate;
        }
      }

      @media (max-width: 1400px) {
        .tracks__item:nth-child(n + 21) {
          display: none;
        }

        .tracks__item {
          left: var(--left-md);
          top: var(--top-md);
          width: var(--size-md);
          height: var(--size-md);
        }
      }

      @media (max-width: 760px) {
        .tracks__item:nth-child(n + 11) {
          display: none;
        }

        .tracks__item {
          left: var(--left-sm);
          top: var(--top-sm);
          width: var(--size-sm);
          height: var(--size-sm);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tracks__item {
          animation: none;
        }
      }
    `,
  ],
})
export class TrackBackgroundComponent {
  readonly placements: Placement[] = CIRCUIT_IDS.map((id, index) => {
    const d = shapeById.get(id);
    if (!d) throw new Error(`Unknown circuit outline: ${id}`);

    const directionX = index % 2 === 0 ? -1 : 1;
    const directionY = index % 3 === 0 ? 1 : -1;
    const spin = (index % 2 === 0 ? -1 : 1) * (2 + hash(index + 31) * 2);

    return {
      d,
      ...buildSlot(index, 6, 5, [125, 195], [5, 7]),
      rotate: Number((-35 + hash(index + 23) * 70).toFixed(1)),
      spin: Number(spin.toFixed(1)),
      duration: Math.round((40_000 + hash(index + 41) * 40_000) / 500) * 500,
      delay: -Math.round(hash(index + 53) * 70_000),
      dx: directionX * (5 + Math.round(hash(index + 61) * 4)),
      dy: directionY * (5 + Math.round(hash(index + 67) * 4)),
      flip: index % 7 === 0 ? true : undefined,
      tablet:
        index < 20
          ? buildSlot(index, 5, 4, [120, 175], [6, 8])
          : undefined,
      mobile:
        index < 10
          ? buildSlot(index, 2, 5, [145, 180], [20, 8])
          : undefined,
    };
  });
}
