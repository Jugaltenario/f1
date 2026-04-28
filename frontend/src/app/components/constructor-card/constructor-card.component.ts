import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Constructor } from '../../core/models/driver.model';

@Component({
  selector: 'app-constructor-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="constructor-card">
      <div class="constructor-logo">
        <img [src]="logoUrl" [alt]="team.name" (error)="onImageError($event)">
      </div>
      <div class="constructor-info">
        <h3>{{ team.name }}</h3>
        <p class="nationality">{{ team.nationality }}</p>
      </div>
    </div>
  `,
  styles: [`
    .constructor-card {
      background: #f8f8f8;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .constructor-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(225,6,0,0.15);
    }
    .constructor-logo {
      height: 150px;
      background: #e8e8e8;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .constructor-logo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .constructor-info {
      padding: 1.5rem;
      text-align: center;
    }
    .constructor-info h3 {
      color: #1a1a1a;
      margin: 0;
      font-size: 1.25rem;
    }
    .nationality {
      color: #666;
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
    }
  `]
})
export class ConstructorCardComponent {
  @Input() team!: Constructor;

  get logoUrl(): string {
    return `https://en.wikipedia.org/wiki/File:${this.team.constructorRef}_logo.png`;
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}