import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Race, Result } from '../../core/models/driver.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home">
      <section class="hero">
        <div class="speed-streaks">
          <div class="streak"></div>
          <div class="streak"></div>
          <div class="streak"></div>
        </div>
        <div class="hero-bg"></div>
        <div class="hero-content fade-in">
          <h1>Formula 1</h1>
          <p class="subtitle">{{ latestRace?.name || 'Welcome to F1' }}</p>
          <p class="date">{{ latestRace?.date | date:'fullDate' }}</p>
          <div class="hero-actions">
            <a routerLink="/drivers" class="btn btn-primary">Drivers</a>
            <a routerLink="/rivalry" class="btn btn-secondary">Compare</a>
          </div>
        </div>
      </section>

      <section class="latest-results" *ngIf="latestResults.length > 0">
        <h2>Latest Race Results</h2>
        <div class="results-grid">
          <div class="result-item" *ngFor="let result of latestResults; let i = index" [class.podium]="i < 3">
            <span class="position">{{ i + 1 }}</span>
            <div class="driver-info">
              <span class="name">{{ result.driver?.forename }} {{ result.driver?.surname }}</span>
              <span class="team">{{ result.constructor?.name }}</span>
            </div>
            <span class="time">{{ result.time || result.positionText }}</span>
            <span class="points">{{ result.points }} pts</span>
          </div>
        </div>
      </section>

      <section class="quick-links">
        <a routerLink="/timeline" class="quick-link">
          <span class="link-icon">📜</span>
          <span class="link-text">F1 History Timeline</span>
          <span class="link-arrow">→</span>
        </a>
        <a routerLink="/rivalry" class="quick-link">
          <span class="link-icon">🏆</span>
          <span class="link-text">Rivalry Engine</span>
          <span class="link-arrow">→</span>
        </a>
      </section>

      <section class="champions" *ngIf="championshipStandings.length > 0">
        <h2>{{ championshipYear }} Championship</h2>
        <div class="standings-grid">
          <div class="standing-item" *ngFor="let standing of championshipStandings; let i = index">
            <span class="pos">{{ standing.position }}</span>
            <span class="name">{{ standing.driver?.forename }} {{ standing.driver?.surname }}</span>
            <span class="points">{{ standing.points }} pts</span>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hero {
      height: 85vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    
    .speed-streaks {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    
    .streak {
      position: absolute;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(225, 6, 0, 0.6), transparent);
      animation: speedStreak 3s infinite;
    }
    
    .streak:nth-child(1) {
      top: 20%;
      width: 300px;
      animation-delay: 0s;
      animation-duration: 2.5s;
    }
    
    .streak:nth-child(2) {
      top: 50%;
      width: 500px;
      animation-delay: 0.8s;
      animation-duration: 2s;
    }
    
    .streak:nth-child(3) {
      top: 80%;
      width: 400px;
      animation-delay: 1.5s;
      animation-duration: 2.2s;
    }
    
    @keyframes speedStreak {
      0% {
        transform: translateX(-100%) skewX(-15deg);
        opacity: 0;
      }
      20% {
        opacity: 1;
      }
      80% {
        opacity: 1;
      }
      100% {
        transform: translateX(200%) skewX(-15deg);
        opacity: 0;
      }
    }
    
    .hero-bg {
      position: absolute;
      inset: 0;
      background: url('/assets/william-FW14B.webp') center/cover no-repeat;
      filter: brightness(0.4);
    }
    
    .hero-content {
      position: relative;
      z-index: 1;
      text-align: center;
      color: #fff;
      padding: 3rem;
    }
    
    .hero-content h1 {
      font-family: 'Titillium Web', sans-serif;
      font-size: clamp(5rem, 18vw, 14rem);
      font-weight: 900;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 4px;
      text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
    }
    
    .subtitle {
      font-family: 'Titillium Web', sans-serif;
      font-size: clamp(1.5rem, 4vw, 3rem);
      margin: 1rem 0 0.5rem;
      opacity: 0.95;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .date {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.25rem;
    }
    
    .hero-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1rem 2.5rem;
      font-family: 'Titillium Web', sans-serif;
      font-weight: 600;
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
    }
    
    .btn-primary {
      background: #e10600;
      color: #fff;
      border-color: #e10600;
    }
    
    .btn-primary:hover {
      background: #cc0500;
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(225, 6, 0, 0.4);
    }
    
    .btn-secondary {
      background: transparent;
      color: #fff;
      border-color: #fff;
    }
    
    .btn-secondary:hover {
      background: #fff;
      color: #1a1a1a;
    }
    
    .latest-results, .champions, .quick-links {
      padding: 4rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h2 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin-bottom: 2rem;
      border-left: 4px solid #e10600;
      padding-left: 1rem;
    }
    
    .quick-links {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    
    .quick-link {
      flex: 1;
      min-width: 280px;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 16px;
      text-decoration: none;
      transition: all 0.3s ease;
    }
    
    .quick-link:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(225, 6, 0, 0.2);
      border-color: rgba(225, 6, 0, 0.4);
    }
    
    .link-icon {
      font-size: 2rem;
    }
    
    .link-text {
      flex: 1;
      font-family: 'Titillium Web', sans-serif;
      font-weight: 600;
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a1a;
    }
    
    .link-arrow {
      color: #e10600;
      font-size: 1.5rem;
      transition: transform 0.3s;
    }
    
    .quick-link:hover .link-arrow {
      transform: translateX(5px);
    }
    
    .results-grid, .standings-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .result-item, .standing-item {
      display: grid;
      grid-template-columns: 50px 1fr auto auto;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(225, 6, 0, 0.1);
      border-radius: 12px;
      transition: all 0.3s;
    }
    
    .result-item:hover, .standing-item:hover {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(225, 6, 0, 0.3);
    }
    
    .result-item.podium {
      background: linear-gradient(90deg, rgba(255, 234, 234, 0.9), rgba(248, 248, 248, 0.9));
    }
    
    .result-item.podium:first-child { border-left: 4px solid #ffd700; }
    .result-item.podium:nth-child(2) { border-left: 4px solid #c0c0c0; }
    .result-item.podium:nth-child(3) { border-left: 4px solid #cd7f32; }
    
    .position {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #e10600;
    }
    
    .name { color: #1a1a1a; font-weight: 500; }
    .team { color: #666; font-size: 0.875rem; }
    .time { color: #888; }
    .points { color: #e10600; font-weight: 600; }
    
    @media (max-width: 768px) {
      .hero { height: 70vh; }
      .hero-content { padding: 2rem 1rem; }
      .hero-actions { flex-direction: column; }
      .result-item, .standing-item {
        grid-template-columns: 40px 1fr auto;
      }
      .team, .time { display: none; }
    }
  `]
})
export class HomeComponent implements OnInit {
  latestRace: Race | null = null;
  latestResults: (Result & { driver?: any; constructor?: any })[] = [];
  championshipYear = new Date().getFullYear();
  championshipStandings: any[] = [];
  private csvDataService = inject(CSVDataService);

  ngOnInit() {
    this.loadLatestResults();
    this.loadChampions();
  }

  loadLatestResults() {
    this.csvDataService.getLatestResults().subscribe({
      next: (data) => {
        this.latestRace = data.race;
        this.latestResults = data.results;
      },
      error: () => {
        this.latestResults = [];
      }
    });
  }

  loadChampions() {
    this.csvDataService.getChampions().subscribe({
      next: (data) => {
        this.championshipYear = data.year;
        this.championshipStandings = data.standings;
      },
      error: () => {
        this.championshipStandings = [];
      }
    });
  }
}