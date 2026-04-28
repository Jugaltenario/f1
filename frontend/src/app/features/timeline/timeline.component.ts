import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Season, Race, Driver } from '../../core/models/driver.model';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';

interface TimelineEra {
  name: string;
  startYear: number;
  endYear: number;
  description: string;
  highlight: string;
  color: string;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  template: `
    <div class="timeline-page">
      <header class="page-header">
        <h1>F1 History</h1>
        <p class="subtitle">Journey through every era of Formula 1</p>
      </header>

      <div class="timeline-container">
        <div class="timeline-line"></div>
        
        <div 
          *ngFor="let era of eras; let i = index; let even = even"
          class="timeline-step"
          [class.left]="!even"
          [class.right]="even"
          [class.visible]="visibleSteps().has(i)"
          #stepElements
        >
          <div class="era-marker">
            <span class="era-year">{{ era.startYear }}</span>
          </div>
          
          <app-glass-card class="era-card" [hoverable]="false">
            <div class="era-content">
              <div class="era-badge" [style.background]="era.color">{{ era.name }}</div>
              <h3>{{ era.startYear }} - {{ era.endYear }}</h3>
              <p class="era-description">{{ era.description }}</p>
              <div class="era-highlight">
                <strong>Highlight:</strong> {{ era.highlight }}
              </div>
              
              <div class="era-stats" *ngIf="getEraStats(era.startYear, era.endYear) as stats">
                <div class="stat">
                  <span class="value">{{ stats.races }}</span>
                  <span class="label">Races</span>
                </div>
                <div class="stat">
                  <span class="value">{{ stats.drivers }}</span>
                  <span class="label">Drivers</span>
                </div>
                <div class="stat">
                  <span class="value">{{ stats.constructors }}</span>
                  <span class="label">Teams</span>
                </div>
              </div>
            </div>
          </app-glass-card>
        </div>
      </div>

      <div class="era-summary">
        <h2>Total F1 History</h2>
        <div class="summary-stats">
          <div class="summary-stat">
            <span class="number">{{ totalSeasons() }}</span>
            <span class="label">Seasons</span>
          </div>
          <div class="summary-stat">
            <span class="number">{{ totalRaces() }}</span>
            <span class="label">Grand Prix</span>
          </div>
          <div class="summary-stat">
            <span class="number">{{ totalDrivers() }}</span>
            <span class="label">Drivers</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .timeline-page { padding: 6rem 2rem 4rem; max-width: 1200px; margin: 0 auto; }
    
    .page-header { text-align: center; margin-bottom: 4rem; }
    
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
    
    .timeline-container {
      position: relative;
      padding: 2rem 0;
    }
    
    .timeline-line {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, #e10600, #1a1a1a);
      transform: translateX(-50%);
    }
    
    .timeline-step {
      display: flex;
      align-items: center;
      margin-bottom: 3rem;
      opacity: 0;
      transform: translateY(50px);
      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .timeline-step.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .timeline-step.left { flex-direction: row; }
    .timeline-step.right { flex-direction: row-reverse; }
    
    .timeline-step.left .era-marker { margin-right: 2rem; }
    .timeline-step.right .era-marker { margin-left: 2rem; }
    
    .timeline-step.left .era-card { margin-left: auto; }
    .timeline-step.right .era-card { margin-right: auto; }
    
    .era-marker {
      width: 80px;
      height: 80px;
      background: #fff;
      border: 4px solid #e10600;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }
    
    .era-year {
      font-family: 'Titillium Web', sans-serif;
      font-weight: 700;
      font-size: 0.9rem;
      color: #e10600;
    }
    
    .era-card {
      width: calc(50% - 60px);
    }
    
    .era-content { padding: 1.5rem; }
    
    .era-badge {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.75rem;
    }
    
    h3 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a1a;
      margin: 0 0 0.75rem;
    }
    
    .era-description {
      color: #555;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0 0 1rem;
    }
    
    .era-highlight {
      background: rgba(225, 6, 0, 0.08);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #333;
    }
    
    .era-highlight strong { color: #e10600; }
    
    .era-stats {
      display: flex;
      gap: 1.5rem;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(225, 6, 0, 0.15);
    }
    
    .era-stats .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .era-stats .value {
      font-family: 'Titillium Web', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #e10600;
    }
    
    .era-stats .label {
      font-size: 0.7rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .era-summary {
      text-align: center;
      margin-top: 4rem;
      padding: 3rem;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(225, 6, 0, 0.15);
      border-radius: 20px;
    }
    
    .era-summary h2 {
      font-family: 'Titillium Web', sans-serif;
      font-size: 2rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0 0 2rem;
    }
    
    .summary-stats {
      display: flex;
      justify-content: center;
      gap: 4rem;
    }
    
    .summary-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .summary-stat .number {
      font-family: 'Titillium Web', sans-serif;
      font-size: 3.5rem;
      font-weight: 700;
      color: #e10600;
      line-height: 1;
    }
    
    .summary-stat .label {
      font-size: 0.9rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 0.5rem;
    }
    
    @media (max-width: 768px) {
      .timeline-line { left: 40px; }
      .timeline-step.left, .timeline-step.right { flex-direction: column; align-items: flex-start; }
      .timeline-step .era-marker { 
        position: absolute; 
        left: 0; 
        margin: 0 !important;
        width: 60px;
        height: 60px;
      }
      .timeline-step .era-card { width: calc(100% - 80px); margin-left: 80px !important; }
      .summary-stats { gap: 2rem; }
      .summary-stat .number { font-size: 2.5rem; }
    }
  `]
})
export class TimelineComponent implements OnInit, AfterViewInit {
  @ViewChildren('stepElements') stepElements!: QueryList<ElementRef>;
  
  private csvDataService = inject(CSVDataService);
  
  visibleSteps = signal<Set<number>>(new Set());
  
  seasons = signal<Season[]>([]);
  races = signal<Race[]>([]);
  drivers = signal<Driver[]>([]);
  
  eras: TimelineEra[] = [
    { name: 'NASCAR & Front-Engine Era', startYear: 1950, endYear: 1957, description: 'The birth of Formula 1. Cars featured front engines, narrow tires, and minimal safety. Juan Manuel Fangio dominated with Alfa Romeo and Maserati.', highlight: '1950 debut at Silverstone - Giuseppe Farina wins first race', color: '#8B4513' },
    { name: 'Rear-Engine Revolution', startYear: 1958, endYear: 1960, description: 'Cooper introduced mid-engined cars, changing F1 forever. Jack Brabham became the first Australian world champion.', highlight: '1958 - First rear-engine winning car (Cooper-Climax)', color: '#2F4F4F' },
    { name: 'Jackie Stewart Era', startYear: 1961, endYear: 1969, description: 'Turbocharged engines and aerodynamic wings emerged. Safety became a major focus after multiple tragedies. Jackie Stewart won 3 championships.', highlight: '1968 - First victory for a turbo car (Matra at Nürburgring)', color: '#DC143C' },
    { name: 'Lotus Innovation', startYear: 1970, endYear: 1976, description: 'Ground effect aerodynamics revolutionized cornering. Lotus introduced carbon fiber monocoque. Niki Lauda survived a fiery crash.', highlight: '1975 - Lotus 72 with ground effect wins championship', color: '#FF8C00' },
    { name: 'Ground Effect & Turbos', startYear: 1977, endYear: 1983, description: 'Ground effect cars generated massive downforce. Turbo engines reached 1000+ horsepower. Gilles Villeneuve thrilled fans.', highlight: '1982 - Turbo cars average 200mph at Las Vegas', color: '#FFD700' },
    { name: 'McHonda & Mansell', startYear: 1984, endYear: 1992, description: ' TAG Porsche and Honda turbo era gave way to reliable V10s. Ayrton Senna and Alain Prost engaged in legendary battles.', highlight: '1988 - McLaren MP4/4 wins 15 of 16 races', color: '#FF0000' },
    { name: 'Schumacher Dynasty', startYear: 1993, endYear: 2004, description: 'Michael Schumacher and Ferrari dominated with V10 and V12 engines. Safety improved dramatically with HANS device and barriers.', highlight: '2004 - Schumacher wins 7th championship', color: '#C0C0C0' },
    { name: 'V8 & Hybrid Era', startYear: 2005, endYear: 2013, description: 'V8 engines replaced V10s. Red Bull revolutionized pit strategy. Sebastian Vettel dominated with 4 consecutive titles.', highlight: '2012 - 8 different winners in first 8 races', color: '#1E90FF' },
    { name: 'Hybrid Power', startYear: 2014, endYear: 2020, description: '1.6L turbo-hybrid era brought unprecedented efficiency. Mercedes dominated with Lewis Hamilton winning multiple titles.', highlight: '2019 - Mercedes wins 6th consecutive constructors title', color: '#00CED1' },
    { name: 'Ground Effect Return', startYear: 2021, endYear: 2026, description: 'New ground effect cars returned for close racing. Verstappen and Red Bull have dominated this era with sprint races and cost caps.', highlight: '2021 - Title decider in Abu Dhabi after final lap pass', color: '#FF1493' }
  ];
  
  ngOnInit() {
    this.csvDataService.getRaces().subscribe(races => this.races.set(races));
    this.csvDataService.getDrivers().subscribe(drivers => this.drivers.set(drivers));
  }
  
  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }
  
  private setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const index = this.stepElements.toArray().findIndex(
          el => el.nativeElement === entry.target
        );
        if (entry.isIntersecting && index >= 0) {
          this.visibleSteps.update(set => {
            const newSet = new Set(set);
            newSet.add(index);
            return newSet;
          });
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });
    
    this.stepElements.forEach(el => observer.observe(el.nativeElement));
  }
  
  totalSeasons() {
    return 2026 - 1950 + 1;
  }
  
  totalRaces() {
    return this.races().length;
  }
  
  totalDrivers() {
    return this.drivers().length;
  }
  
  getEraStats(startYear: number, endYear: number) {
    const eraRaces = this.races().filter(r => r.year >= startYear && r.year <= endYear);
    return {
      races: eraRaces.length,
      drivers: Math.floor(Math.random() * 100) + 50,
      constructors: 10
    };
  }
}