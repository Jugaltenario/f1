import { Component, computed, input } from '@angular/core';
import { OpenF1CarData } from '../../../core/models/openf1.model';

/**
 * Lightweight speed trace for a single lap. Uses a normalised SVG viewBox so it
 * scales to any card width without a charting dependency.
 */
@Component({
  selector: 'app-telemetry-chart',
  standalone: true,
  template: `
    <div class="telemetry">
      <div class="telemetry__stats">
        <span><strong>{{ maxSpeed() }}</strong> km/h top</span>
        <span><strong>{{ averageSpeed() }}</strong> km/h avg</span>
        <span><strong>{{ gearChanges() }}</strong> gear changes</span>
        <span><strong>{{ drsShare() }}%</strong> DRS</span>
      </div>

      @if (points().length > 1) {
        <svg viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Speed telemetry trace">
          <defs>
            <linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="accent()" stop-opacity="0.42" />
              <stop offset="100%" [attr.stop-color]="accent()" stop-opacity="0" />
            </linearGradient>
          </defs>

          @for (tick of ticks(); track tick) {
            <line class="grid" x1="0" x2="600" [attr.y1]="tick" [attr.y2]="tick" />
          }

          <path [attr.d]="area()" fill="url(#speedFill)" />
          <path [attr.d]="line()" fill="none" [attr.stroke]="accent()" stroke-width="2.4" stroke-linejoin="round" />

          @for (point of brakePoints(); track point.x) {
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="2.4" fill="#ff5a52" />
          }
        </svg>

        <div class="telemetry__legend">
          <span class="telemetry__legend-item"><span class="dot dot--speed"></span>Speed</span>
          <span class="telemetry__legend-item"><span class="dot dot--brake"></span>Braking</span>
          <span class="telemetry__legend-item telemetry__legend-item--muted">{{ points().length }} samples</span>
        </div>
      } @else {
        <div class="telemetry__placeholder">No telemetry samples for this lap window.</div>
      }
    </div>
  `,
  styles: [
    `
      .telemetry {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .telemetry__stats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1.25rem;
        font-size: 0.78rem;
        color: var(--text-3);
      }

      .telemetry__stats strong {
        color: var(--text);
        font-size: 0.92rem;
        font-weight: 700;
      }

      svg {
        width: 100%;
        height: clamp(160px, 22vw, 240px);
        overflow: visible;
      }

      .grid {
        stroke: var(--divider);
        stroke-width: 1;
        stroke-dasharray: 2 6;
      }

      .telemetry__legend {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.72rem;
        color: var(--text-2);
      }

      .telemetry__legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .telemetry__legend-item--muted {
        color: var(--text-3);
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        display: inline-block;
      }

      .dot--speed {
        background: var(--accent);
      }

      .dot--brake {
        background: #ff5a52;
      }

      .telemetry__placeholder {
        display: grid;
        place-items: center;
        min-height: 150px;
        border-radius: var(--r-sm);
        border: 1px dashed var(--border);
        color: var(--text-3);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class TelemetryChartComponent {
  readonly car = input.required<OpenF1CarData[]>();
  readonly accent = input('#ff2d20');

  private readonly sampled = computed(() => {
    const rows = this.car();
    if (rows.length <= 480) return rows;
    const step = Math.ceil(rows.length / 480);
    return rows.filter((_, index) => index % step === 0);
  });

  readonly maxSpeed = computed(() =>
    Math.round(this.car().reduce((max, point) => Math.max(max, point.speed ?? 0), 0)),
  );

  readonly averageSpeed = computed(() => {
    const rows = this.car();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, point) => sum + (point.speed ?? 0), 0) / rows.length);
  });

  readonly gearChanges = computed(() => {
    const rows = this.car();
    let changes = 0;
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].n_gear !== rows[i - 1].n_gear) changes += 1;
    }
    return changes;
  });

  readonly drsShare = computed(() => {
    const rows = this.car();
    if (!rows.length) return 0;
    const open = rows.filter((point) => (point.drs ?? 0) >= 10).length;
    return Math.round((open / rows.length) * 100);
  });

  readonly points = computed(() =>
    this.sampled().map((row, index, all) => {
      const x = all.length <= 1 ? 0 : (index / (all.length - 1)) * 600;
      const speed = Math.max(0, Math.min(360, row.speed ?? 0));
      const y = 190 - (speed / 360) * 178;
      return { x, y, brake: (row.brake ?? 0) > 0 };
    }),
  );

  readonly line = computed(() => {
    const points = this.points();
    return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  });

  readonly area = computed(() => {
    const points = this.points();
    if (!points.length) return '';
    return `${this.line()} L 600 200 L 0 200 Z`;
  });

  readonly brakePoints = computed(() => this.points().filter((point) => point.brake));

  readonly ticks = computed(() => [30, 70, 110, 150, 190]);
}
