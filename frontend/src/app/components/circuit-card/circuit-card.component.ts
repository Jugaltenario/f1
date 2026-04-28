import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Circuit } from '../../core/models/driver.model';

@Component({
  selector: 'app-circuit-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="circuit-card">
      <div class="circuit-image">
        <img [src]="imageUrl" [alt]="circuit.name" (error)="onImageError($event)">
      </div>
      <div class="circuit-info">
        <h3>{{ circuit.name }}</h3>
        <p class="location">{{ circuit.location }}, {{ circuit.country }}</p>
      </div>
    </div>
  `,
  styles: [`
    .circuit-card {
      background: #f8f8f8;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .circuit-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(225,6,0,0.15);
    }
    .circuit-image {
      height: 150px;
      background: #e8e8e8;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .circuit-image img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .circuit-info {
      padding: 1.5rem;
      text-align: center;
    }
    .circuit-info h3 {
      color: #1a1a1a;
      margin: 0;
      font-size: 1.1rem;
    }
    .location {
      color: #666;
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
    }
  `]
})
export class CircuitCardComponent {
  @Input() circuit!: Circuit;

  get imageUrl(): string {
    return `https://en.wikipedia.org/wiki/File:${this.circuit.circuitRef}_circuit.png`;
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}