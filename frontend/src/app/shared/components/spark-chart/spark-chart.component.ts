import { Component, computed, input } from '@angular/core';

export interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

interface RenderedSeries extends ChartSeries {
  path: string;
  dots: { x: number; y: number; value: number }[];
}

/**
 * A dependency-free SVG line chart. Used for career point trajectories where a
 * full charting library would be overkill.
 */
@Component({
  selector: 'app-spark-chart',
  standalone: true,
  template: `
    <div class="chart">
      <div class="chart__legend">
        @for (series of series(); track series.label) {
          <span class="chart__legend-item">
            <span class="chart__swatch" [style.background]="series.color"></span>{{ series.label }}
          </span>
        }
      </div>
      <svg viewBox="0 0 600 220" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="none">
        @for (tick of yTicks(); track tick.value) {
          <line class="chart__grid" x1="0" x2="600" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="chart__axis" x="4" [attr.y]="tick.y - 4">{{ tick.label }}</text>
        }
        @for (item of xLabels(); track item.index) {
          <text class="chart__axis chart__axis--x" [attr.x]="item.x" y="216" text-anchor="middle">
            {{ item.label }}
          </text>
        }
        @for (series of rendered(); track series.label) {
          <path class="chart__line" [attr.d]="series.path" [attr.stroke]="series.color" />
          @for (dot of series.dots; track dot.x) {
            <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3.5" [attr.fill]="series.color" />
            <title>{{ series.label }} · {{ dot.value }}</title>
          }
        }
      </svg>
    </div>
  `,
  styles: [
    `
      .chart {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .chart__legend {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .chart__legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-2);
      }

      .chart__swatch {
        width: 10px;
        height: 3px;
        border-radius: 999px;
      }

      svg {
        width: 100%;
        height: auto;
        overflow: visible;
      }

      .chart__grid {
        stroke: var(--divider);
        stroke-width: 1;
        stroke-dasharray: 3 5;
      }

      .chart__axis {
        fill: var(--text-3);
        font-size: 10px;
        font-family: var(--font-ui);
      }

      .chart__line {
        fill: none;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
})
export class SparkChartComponent {
  readonly series = input.required<ChartSeries[]>();
  readonly axisLabels = input<string[]>([]);
  readonly ariaLabel = input('Line chart');

  private readonly max = computed(() => {
    const values = this.series().flatMap((series) => series.values).filter((value): value is number => value !== null);
    return Math.max(1, ...values) * 1.08;
  });

  private readonly count = computed(() => {
    const values = this.series()[0]?.values.length ?? 0;
    return Math.max(1, values);
  });

  readonly rendered = computed<RenderedSeries[]>(() => {
    const max = this.max();
    const count = this.count();

    return this.series().map((series) => {
      const points = series.values.map((value, index) => {
        const x = count === 1 ? 300 : 16 + (index / (count - 1)) * 568;
        const y = 196 - ((value ?? 0) / max) * 176;
        return { x, y, value: value ?? 0 };
      });

      let path = '';
      for (const point of points) {
        path += path ? ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}` : `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }

      return { ...series, path, dots: points };
    });
  });

  readonly yTicks = computed(() => {
    const max = this.max();
    return [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      value: fraction,
      y: 196 - fraction * 176,
      label: Math.round(max * fraction).toString(),
    }));
  });

  readonly xLabels = computed(() => {
    const labels = this.axisLabels();
    const count = this.count();
    return labels.map((label, index) => ({
      label,
      index,
      x: count === 1 ? 300 : 16 + (index / (count - 1)) * 568,
    }));
  });
}
