import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-glass-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card" [class.hoverable]="hoverable" [class.clickable]="clickable">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .glass-card {
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .glass-card.hoverable:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 48px rgba(225, 6, 0, 0.2);
      border-color: rgba(225, 6, 0, 0.4);
    }

    .glass-card.clickable {
      cursor: pointer;
    }
  `]
})
export class GlassCardComponent {
  @Input() hoverable = true;
  @Input() clickable = false;
}