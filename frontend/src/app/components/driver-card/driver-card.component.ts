import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Driver } from '../../core/models/driver.model';

@Component({
  selector: 'app-driver-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="driver-card">
      <div class="driver-image">
        <img [src]="driverImageUrl" [alt]="driver.code" (error)="onImageError($event)">
      </div>
      <div class="driver-info">
        <div class="driver-number">{{ driver.number || '—' }}</div>
        <h3>{{ driver.forename }} {{ driver.surname }}</h3>
        <p class="code">{{ driver.code }}</p>
        <p class="nationality">{{ driver.nationality }}</p>
      </div>
    </div>
  `,
  styles: [`
    .driver-card {
      background: #f8f8f8;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .driver-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(225,6,0,0.15);
    }
    .driver-image {
      height: 200px;
      background: #e8e8e8;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .driver-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .driver-card:hover .driver-image img {
      transform: scale(1.1);
    }
    .driver-info {
      padding: 1.5rem;
      text-align: center;
    }
    .driver-number {
      background: #e10600;
      color: #fff;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin: -2.5rem auto 1rem;
      position: relative;
    }
    .driver-info h3 {
      color: #1a1a1a;
      margin: 0;
      font-size: 1.25rem;
    }
    .code {
      color: #e10600;
      font-weight: 600;
      font-size: 0.875rem;
      margin: 0.5rem 0;
    }
    .nationality {
      color: #666;
      margin: 0;
      font-size: 0.875rem;
    }
  `]
})
export class DriverCardComponent {
  @Input() driver!: Driver;

  get driverImageUrl(): string {
    return `https://media.githubusercontent.com/media/theOehrly/Fast-F1/develop/fastf1/images/drivers/${this.driver.driverRef}.png`;
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'https://via.placeholder.com/200x200/f8f8f8/1a1a1a?text=' + (this.driver.code || this.driver.forename[0]);
  }
}