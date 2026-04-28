import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Driver, RivalryData, SeasonStanding } from '../../core/models/driver.model';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';

@Component({
  selector: 'app-rivalry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rivalry-page">
      <header class="page-header">
        <h1>Rivalry Engine</h1>
        <p class="subtitle">Compare two drivers across their entire F1 career</p>
      </header>

      <div class="driver-selector" *ngIf="!rivalryData()">
        <div class="selector-column">
          <h3>Select Driver 1</h3>
          <div class="driver-list">
            <button 
              *ngFor="let driver of championDrivers()"
              (click)="selectDriver1(driver)"
              class="driver-btn"
            >
              <span class="driver-name">{{ driver.forename }} {{ driver.surname }}</span>
              <span class="driver-wins">{{ driver.wins }} wins</span>
            </button>
          </div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="selector-column">
          <h3>Select Driver 2</h3>
          <div class="driver-list">
            <button 
              *ngFor="let driver of championDrivers()"
              (click)="selectDriver2(driver)"
              class="driver-btn"
              [disabled]="driver1?.driverId === driver.driverId"
            >
              <span class="driver-name">{{ driver.forename }} {{ driver.surname }}</span>
              <span class="driver-wins">{{ driver.wins }} wins</span>
            </button>
          </div>
        </div>
      </div>

      <div class="comparison-view" *ngIf="rivalryData()">
        <button class="back-btn" (click)="resetSelection()">
          ← Select Different Drivers
        </button>

        <div class="comparison-header">
          <div class="driver-header">
            <img [src]="getDriverImage(driver1!)" [alt]="driver1!.code">
            <h2>{{ driver1!.forename }} {{ driver1!.surname }}</h2>
          </div>
          <div class="vs-badge">VS</div>
          <div class="driver-header">
            <img [src]="getDriverImage(driver2!)" [alt]="driver2!.code">
            <h2>{{ driver2!.forename }} {{ driver2!.surname }}</h2>
          </div>
        </div>

        <div class="career-stats">
          <div class="stats-column">
            <div class="total-stat">
              <span class="label">Total Wins</span>
              <span class="value">{{ getTotalWins(driver1Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Total Podiums</span>
              <span class="value">{{ getTotalPodiums(driver1Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Total Poles</span>
              <span class="value">{{ getTotalPoles(driver1Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Seasons</span>
              <span class="value">{{ driver1Stats.length }}</span>
            </div>
          </div>
          <div class="stats-column">
            <div class="total-stat">
              <span class="label">Total Wins</span>
              <span class="value">{{ getTotalWins(driver2Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Total Podiums</span>
              <span class="value">{{ getTotalPodiums(driver2Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Total Poles</span>
              <span class="value">{{ getTotalPoles(driver2Stats) }}</span>
            </div>
            <div class="total-stat">
              <span class="label">Seasons</span>
              <span class="value">{{ driver2Stats.length }}</span>
            </div>
          </div>
        </div>

        <div class="timeline-comparison">
          <h3>Season-by-Season Comparison</h3>
          <div class="timeline-header">
            <span>Year</span>
            <span>{{ driver1!.surname }}</span>
            <span>{{ driver2!.surname }}</span>
          </div>
          <div class="timeline-body">
            <div 
              *ngFor="let year of allYears(); let idx = index" 
              class="timeline-row"
              [class.d1-win]="comparePosition(idx, 'd1') === 'win'"
              [class.d2-win]="comparePosition(idx, 'd2') === 'win'"
              [class.tie]="comparePosition(idx, 'd1') === 'tie'"
            >
              <span class="year">{{ year }}</span>
              <span class="position">{{ getDisplayPosition(driver1Stats, idx) }}</span>
              <span class="position">{{ getDisplayPosition(driver2Stats, idx) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rivalry-page { padding: 6rem 2rem 4rem; max-width: 1200px; margin: 0 auto; }
    
    .page-header { text-align: center; margin-bottom: 3rem; }
    
    h1 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 3rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0;
    }
    
    .subtitle {
      color: #666;
      font-size: 1.1rem;
      margin: 0.5rem 0 0;
    }
    
    .driver-selector {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }
    
    .selector-column {
      flex: 1;
    }
    
    .selector-column h3 {
      font-family: 'Titillium Web', sans-serif;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a1a;
      margin-bottom: 1rem;
    }
    
    .driver-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .driver-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      cursor: pointer;
      transition: all 0.3s;
      text-align: left;
    }
    
    .driver-btn:hover:not(:disabled) {
      background: rgba(225, 6, 0, 0.1);
      border-color: #e10600;
      transform: translateX(4px);
    }
    
    .driver-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    
    .driver-name {
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .driver-wins {
      font-size: 0.85rem;
      color: #e10600;
    }
    
    .vs-divider {
      font-family: 'Titillium Web', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: #e10600;
      padding-top: 3rem;
    }
    
    .back-btn {
      background: none;
      border: none;
      color: #e10600;
      font-size: 1rem;
      cursor: pointer;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .back-btn:hover { text-decoration: underline; }
    
    .comparison-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    
    .driver-header {
      text-align: center;
    }
    
    .driver-header img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 0.5rem;
    }
    
    .driver-header h2 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
      color: #1a1a1a;
    }
    
    .vs-badge {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #e10600;
      background: rgba(225, 6, 0, 0.1);
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
    }
    
    .career-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 3rem;
    }
    
    .stats-column {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 16px;
      padding: 1.5rem;
    }
    
    .total-stat {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(225, 6, 0, 0.1);
    }
    
    .total-stat:last-child { border-bottom: none; }
    
    .total-stat .label {
      color: #666;
      font-size: 0.9rem;
    }
    
    .total-stat .value {
      font-weight: 700;
      color: #e10600;
      font-size: 1.1rem;
    }
    
    .timeline-comparison {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 16px;
      padding: 1.5rem;
    }
    
    .timeline-comparison h3 {
      font-family: 'Titillium Web', sans-serif;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a1a;
      margin: 0 0 1.5rem;
      text-align: center;
    }
    
    .timeline-header, .timeline-row {
      display: grid;
      grid-template-columns: 80px 1fr 1fr;
      gap: 1rem;
      align-items: center;
      padding: 0.75rem 1rem;
    }
    
    .timeline-header {
      font-weight: 600;
      color: #666;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid rgba(225, 6, 0, 0.2);
    }
    
    .timeline-row {
      border-bottom: 1px solid rgba(225, 6, 0, 0.08);
      transition: background 0.2s;
    }
    
    .timeline-row:hover {
      background: rgba(225, 6, 0, 0.05);
    }
    
    .timeline-row.d1-win {
      background: linear-gradient(90deg, rgba(225, 6, 0, 0.1), transparent);
    }
    
    .timeline-row.d2-win {
      background: linear-gradient(90deg, transparent, rgba(225, 6, 0, 0.1));
    }
    
    .timeline-row.tie {
      background: rgba(225, 6, 0, 0.05);
    }
    
    .year { font-weight: 600; color: #1a1a1a; }
    
    .position {
      text-align: center;
      font-weight: 700;
      font-size: 1.1rem;
    }
    
    .d1-win .position:first-of-type { color: #e10600; }
    .d2-win .position:last-of-type { color: #e10600; }
    .tie .position { color: #888; }
    
    @media (max-width: 768px) {
      .driver-selector { flex-direction: column; }
      .vs-divider { padding: 0.5rem 0; text-align: center; }
      .comparison-header { flex-direction: column; gap: 1rem; }
      .career-stats { grid-template-columns: 1fr; }
    }
  `]
})
export class RivalryComponent implements OnInit {
  private csvDataService = inject(CSVDataService);
  
  drivers = signal<Driver[]>([]);
  driver1: Driver | null = null;
  driver2: Driver | null = null;
  rivalryData = signal<{ driver1: RivalryData; driver2: RivalryData } | null>(null);
  
  ngOnInit() {
    this.csvDataService.getDriverStats().subscribe(drivers => {
      this.drivers.set(drivers);
    });
  }

  championDrivers() {
    return this.drivers()
      .filter(d => (d.wins || 0) >= 5)
      .sort((a, b) => (b.wins || 0) - (a.wins || 0))
      .slice(0, 20);
  }

  selectDriver1(driver: Driver) {
    this.driver1 = driver;
    if (this.driver2) this.loadRivalry();
  }

  selectDriver2(driver: Driver) {
    this.driver2 = driver;
    if (this.driver1) this.loadRivalry();
  }

  loadRivalry() {
    if (!this.driver1 || !this.driver2) return;
    // For now, just show basic comparison using driver stats from API
    const d1Stats = this.drivers().find(d => d.driverId === this.driver1!.driverId);
    const d2Stats = this.drivers().find(d => d.driverId === this.driver2!.driverId);
    
     if (d1Stats && d2Stats) {
       const d1Id: number = d1Stats.driverId;
       const d2Id: number = d2Stats.driverId;
       this.rivalryData.set({
         driver1: {
           driverId: d1Id,
           driverName: `${d1Stats.forename} ${d1Stats.surname}`,
           standings: [{
             year: new Date().getFullYear(),
             position: 0,
             points: 0,
             wins: d1Stats.wins || 0,
             podiums: d1Stats.podiums || 0,
             poles: d1Stats.poles || 0
           }]
         },
         driver2: {
           driverId: d2Id,
           driverName: `${d2Stats.forename} ${d2Stats.surname}`,
           standings: [{
             year: new Date().getFullYear(),
             position: 0,
             points: 0,
             wins: d2Stats.wins || 0,
             podiums: d2Stats.podiums || 0,
             poles: d2Stats.poles || 0
           }]
         }
       });
     }
  }

  resetSelection() {
    this.driver1 = null;
    this.driver2 = null;
    this.rivalryData.set(null);
  }

  get driver1Stats() {
    return this.rivalryData()?.driver1.standings || [];
  }

  get driver2Stats() {
    return this.rivalryData()?.driver2.standings || [];
  }

  allYears(): number[] {
    const years1 = new Set(this.driver1Stats.map(s => s.year));
    const years2 = new Set(this.driver2Stats.map(s => s.year));
    const combined = new Set([...Array.from(years1), ...Array.from(years2)]);
    return Array.from(combined).sort((a: number, b: number) => a - b);
  }

  getPosition(stats: SeasonStanding[], year: number): number | null {
    const stat = stats.find(s => s.year === year);
    return stat?.position || null;
  }

  comparePosition(index: number, driver: 'd1' | 'd2'): string {
    const years = this.allYears();
    const year = years[index];
    const pos1 = this.getPosition(this.driver1Stats, year);
    const pos2 = this.getPosition(this.driver2Stats, year);
    
    if (pos1 === null || pos2 === null) return '';
    if (pos1 < pos2) return driver === 'd1' ? 'win' : 'lose';
    if (pos1 > pos2) return driver === 'd2' ? 'win' : 'lose';
    return 'tie';
  }

  getDisplayPosition(stats: SeasonStanding[], index: number): string {
    const years = this.allYears();
    const year = years[index];
    const pos = this.getPosition(stats, year);
    return pos ? String(pos) : '—';
  }

  getTotalWins(stats: SeasonStanding[]): number {
    return stats.reduce((sum, s) => sum + s.wins, 0);
  }

  getTotalPodiums(stats: SeasonStanding[]): number {
    return stats.reduce((sum, s) => sum + s.podiums, 0);
  }

  getTotalPoles(stats: SeasonStanding[]): number {
    return stats.reduce((sum, s) => sum + s.poles, 0);
  }

  getDriverImage(driver: Driver): string {
    return `https://media.githubusercontent.com/media/theOehrly/Fast-F1/develop/fastf1/images/drivers/${driver.driverRef}.png`;
  }
}