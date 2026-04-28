import { Component, OnInit, inject, signal, computed, effect, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DriverStateService, DriverFilter } from '../../core/services/driver-state.service';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';
import { Driver } from '../../core/models/driver.model';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent],
  template: `
    <div class="drivers-page">
      <header class="page-header">
        <h1>Drivers</h1>
        <div class="filters">
          <div class="search-box">
            <input 
              type="text" 
              [ngModel]="state.searchTerm()"
              (ngModelChange)="state.setSearch($event)"
              placeholder="Search drivers..."
            >
          </div>
          <div class="filter-group">
            <button 
              *ngFor="let f of filterOptions"
              [class.active]="state.filterType() === f.value"
              (click)="state.setFilter(f.value)"
            >{{ f.label }}</button>
          </div>
          <select 
            [ngModel]="state.selectedNationality()"
            (ngModelChange)="state.setNationality($event)"
          >
            <option *ngFor="let nat of state.nationalities()" [value]="nat">
              {{ nat === 'all' ? 'All Nationalities' : nat }}
            </option>
          </select>
        </div>
      </header>

      <div class="drivers-grid" *ngIf="!state.isLoading()">
        <app-glass-card 
          *ngFor="let driver of state.filteredDrivers(); let i = index"
          [hoverable]="true"
          [clickable]="true"
          (click)="selectDriver(driver)"
          class="fade-in-card"
          [style.animation-delay]="i * 50 + 'ms'"
        >
          <div class="driver-card">
            <div class="driver-number">{{ driver.number || '—' }}</div>
            <div class="driver-image">
              <img [src]="getDriverImage(driver)" [alt]="driver.code" (error)="onImageError($event, driver)">
            </div>
            <div class="driver-info">
              <h3>{{ driver.forename }} {{ driver.surname }}</h3>
              <p class="code">{{ driver.code || '—' }}</p>
              <p class="nationality">{{ driver.nationality }}</p>
              <div class="driver-stats">
                <div class="stat">
                  <span class="label">Wins</span>
                  <span class="value">{{ driver.wins || 0 }}</span>
                </div>
                <div class="stat">
                  <span class="label">Podiums</span>
                  <span class="value">{{ driver.podiums || 0 }}</span>
                </div>
                <div class="stat">
                  <span class="label">Poles</span>
                  <span class="value">{{ driver.poles || 0 }}</span>
                </div>
              </div>
              <p class="debut" *ngIf="driver.debutYear">Debut: {{ driver.debutYear }}</p>
            </div>
          </div>
        </app-glass-card>
      </div>

      <div class="loading" *ngIf="state.isLoading()">
        <div class="spinner"></div>
        <p>Loading drivers...</p>
      </div>

      <p class="no-results" *ngIf="!state.isLoading() && state.filteredDrivers().length === 0">
        No drivers found matching your criteria
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .drivers-page { padding: 6rem 2rem 4rem; max-width: 1400px; margin: 0 auto; }
    
    .page-header {
      margin-bottom: 2rem;
    }
    
    h1 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 3rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0 0 1.5rem 0;
    }
    
    .filters {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .search-box input {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      border: 2px solid rgba(225, 6, 0, 0.2);
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      color: #1a1a1a;
      font-size: 1rem;
      width: 280px;
      transition: all 0.3s;
    }
    
    .search-box input:focus {
      outline: none;
      border-color: #e10600;
      box-shadow: 0 0 0 3px rgba(225, 6, 0, 0.1);
    }
    
    .filter-group {
      display: flex;
      gap: 0.5rem;
    }
    
    .filter-group button {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(225, 6, 0, 0.2);
      border-radius: 6px;
      padding: 0.6rem 1rem;
      color: #1a1a1a;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s;
      font-family: 'Titillium Web', sans-serif;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 0.85rem;
    }
    
    .filter-group button:hover {
      background: rgba(225, 6, 0, 0.1);
      border-color: rgba(225, 6, 0, 0.4);
    }
    
    .filter-group button.active {
      background: #e10600;
      color: #fff;
      border-color: #e10600;
    }
    
    select {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      border: 2px solid rgba(225, 6, 0, 0.2);
      border-radius: 8px;
      padding: 0.6rem 1rem;
      color: #1a1a1a;
      font-size: 0.95rem;
      cursor: pointer;
      font-family: 'Titillium Web', sans-serif;
    }
    
    select:focus {
      outline: none;
      border-color: #e10600;
    }
    
    .drivers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    
    .driver-card {
      padding: 1.5rem;
      text-align: center;
    }
    
    .driver-number {
      background: linear-gradient(135deg, #e10600, #cc0500);
      color: #fff;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.25rem;
      margin: -3.5rem auto 1rem;
      position: relative;
      z-index: 1;
      box-shadow: 0 4px 15px rgba(225, 6, 0, 0.4);
    }
    
    .driver-image {
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }
    
    .driver-image img {
      max-height: 120px;
      max-width: 100%;
      object-fit: contain;
    }
    
    .driver-info h3 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a1a;
      margin: 0.5rem 0 0.25rem;
    }
    
    .code {
      color: #e10600;
      font-weight: 700;
      font-size: 1rem;
      margin: 0;
    }
    
    .nationality {
      color: #666;
      font-size: 0.875rem;
      margin: 0.25rem 0 1rem;
    }
    
    .driver-stats {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      padding: 1rem 0;
      border-top: 1px solid rgba(225, 6, 0, 0.1);
      border-bottom: 1px solid rgba(225, 6, 0, 0.1);
    }
    
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .stat .label {
      font-size: 0.7rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .stat .value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #e10600;
    }
    
    .debut {
      font-size: 0.8rem;
      color: #999;
      margin: 0.75rem 0 0;
    }
    
    .loading {
      text-align: center;
      padding: 4rem;
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(225, 6, 0, 0.2);
      border-top-color: #e10600;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .no-results {
      text-align: center;
      color: #666;
      padding: 4rem;
      font-size: 1.1rem;
    }
    
    .fade-in-card {
      animation: cardFadeIn 0.5s ease forwards;
      opacity: 0;
    }
    
    @keyframes cardFadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @media (max-width: 768px) {
      .drivers-page { padding: 5rem 1rem 2rem; }
      .filters { flex-direction: column; }
      .search-box input, select { width: 100%; }
      .drivers-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    }
  `]
})
export class DriversComponent implements OnInit {
  state = inject(DriverStateService);
  
  selectedDriver = signal<Driver | null>(null);
  
  filterOptions: { value: DriverFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'legend', label: 'Legends' }
  ];

  ngOnInit() {
    this.state.loadDrivers();
  }

  getDriverImage(driver: Driver): string {
    return `https://media.githubusercontent.com/media/theOehrly/Fast-F1/develop/fastf1/images/drivers/${driver.driverRef}.png`;
  }

  onImageError(event: Event, driver: Driver) {
    const img = event.target as HTMLImageElement;
    img.src = `https://via.placeholder.com/150x150/f8f8f8/1a1a1a?text=${driver.code || driver.forename[0]}`;
  }

  selectDriver(driver: Driver) {
    this.selectedDriver.set(driver);
  }

  closeDetail() {
    this.selectedDriver.set(null);
  }
}

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <app-glass-card class="detail-modal" (click)="$event.stopPropagation()">
        <button class="close-btn" (click)="close.emit()">×</button>
        <div class="detail-content">
          <div class="detail-header">
            <div class="detail-number">{{ driver.number || '—' }}</div>
            <h2>{{ driver.forename }} {{ driver.surname }}</h2>
            <p class="detail-code">{{ driver.code || '—' }}</p>
          </div>
          <div class="detail-stats">
            <div class="stat-item">
              <span class="label">Nationality</span>
              <span class="value">{{ driver.nationality }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Debut Year</span>
              <span class="value">{{ driver.debutYear || 'N/A' }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Wins</span>
              <span class="value highlight">{{ driver.wins || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Podiums</span>
              <span class="value highlight">{{ driver.podiums || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="label">Pole Positions</span>
              <span class="value highlight">{{ driver.poles || 0 }}</span>
            </div>
          </div>
        </div>
      </app-glass-card>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
      animation: fadeIn 0.3s ease;
    }
    
    .detail-modal {
      max-width: 500px;
      width: 100%;
      animation: slideUp 0.4s ease;
      position: relative;
    }
    
    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 2rem;
      color: #666;
      cursor: pointer;
      line-height: 1;
      z-index: 1;
    }
    
    .close-btn:hover { color: #e10600; }
    
    .detail-content { padding: 2rem; }
    
    .detail-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .detail-number {
      background: linear-gradient(135deg, #e10600, #cc0500);
      color: #fff;
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.75rem;
      margin: -4rem auto 1.5rem;
      box-shadow: 0 4px 20px rgba(225, 6, 0, 0.4);
    }
    
    h2 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 2rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0;
    }
    
    .detail-code {
      color: #e10600;
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0.5rem 0 0;
    }
    
    .detail-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .stat-item {
      background: rgba(225, 6, 0, 0.05);
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }
    
    .stat-item .label {
      display: block;
      font-size: 0.75rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.5rem;
    }
    
    .stat-item .value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .stat-item .value.highlight {
      color: #e10600;
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DriverDetailComponent {
  @Input() driver!: Driver;
  @Output() close = new EventEmitter<void>();
}