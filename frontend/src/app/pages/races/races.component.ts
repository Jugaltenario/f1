import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Race } from '../../core/models/driver.model';

@Component({
  selector: 'app-races',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="races-page">
      <header class="page-header">
        <h1>Races</h1>
      </header>
      <div class="loading" *ngIf="isLoading">
        <p>Loading races...</p>
      </div>
      <div class="races-list" *ngIf="!isLoading">
        <a *ngFor="let race of races" [routerLink]="['/races', race.raceId]" class="race-card">
          <div class="race-round">{{ race.round }}</div>
          <div class="race-info">
            <h3>{{ race.name }}</h3>
            <p>{{ race.date | date:'mediumDate' }} ({{ race.year }})</p>
          </div>
          <div class="race-arrow">→</div>
        </a>
      </div>
      <p class="no-results" *ngIf="!isLoading && races.length === 0">No races found</p>
    </div>
  `,
  styles: [`
    .races-page { padding: 6rem 2rem 4rem; max-width: 1000px; margin: 0 auto; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    h1 { color: #1a1a1a; font-size: 2.5rem; margin: 0; }
    .year-filter select {
      background: #f8f8f8;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #1a1a1a;
      font-size: 1rem;
      cursor: pointer;
    }
    .year-filter select:focus { outline: none; border-color: #e10600; }
    .races-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .race-card {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.5rem;
      background: #f8f8f8;
      border-radius: 12px;
      text-decoration: none;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .race-card:hover {
      transform: translateX(8px);
      box-shadow: -4px 0 0 #e10600;
    }
    .race-round {
      width: 50px;
      height: 50px;
      background: #e10600;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    .race-info { flex: 1; }
    .race-info h3 {
      color: #1a1a1a;
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
    }
    .race-info p { color: #666; margin: 0; }
    .race-arrow {
      color: #ccc;
      font-size: 1.5rem;
    }
    .no-results {
      color: #666;
      text-align: center;
      padding: 4rem;
    }
    @media (max-width: 768px) {
      .races-page { padding: 5rem 1rem 2rem; }
      .race-card { padding: 1rem; gap: 1rem; }
      .race-round { width: 40px; height: 40px; font-size: 1rem; }
    }
  `]
})
export class RacesComponent implements OnInit {
  races: Race[] = [];
  isLoading = true;
  private csvDataService = inject(CSVDataService);

  ngOnInit() {
    this.isLoading = true;
    this.csvDataService.getRaces().subscribe({
      next: (races) => {
        this.races = races.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return a.round - b.round;
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load races', err);
        this.isLoading = false;
      }
    });
  }
}