import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TimelineEra {
  year: string;
  title: string;
  description: string;
  highlights: string[];
}

interface Story {
  id: string;
  title: string;
  year: number;
  description: string;
  imageUrl: string;
}

interface Rivalry {
  id: string;
  driver1: string;
  driver2: string;
  years: string;
  team: string;
  description: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page">
      <header class="page-header">
        <h1>Formula 1 History</h1>
        <p class="subtitle">The story of the world's most prestigious racing championship</p>
      </header>

      <section class="timeline-section">
        <h2>The Evolution of F1</h2>
        <div class="timeline">
          <div class="timeline-item" *ngFor="let era of timeline; let i = index" [class.even]="i % 2 === 0">
            <div class="timeline-year">{{ era.year }}</div>
            <div class="timeline-content">
              <h3>{{ era.title }}</h3>
              <p>{{ era.description }}</p>
              <ul>
                <li *ngFor="let highlight of era.highlights">{{ highlight }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="stories-section">
        <h2>Famous Stories</h2>
        <div class="stories-grid">
          <div class="story-card" *ngFor="let story of stories">
            <div class="story-image">
              <img [src]="story.imageUrl" [alt]="story.title" (error)="onImageError($event)">
            </div>
            <div class="story-content">
              <span class="year">{{ story.year }}</span>
              <h3>{{ story.title }}</h3>
              <p>{{ story.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rivalries-section">
        <h2>Famous Rivalries</h2>
        <div class="rivalries-grid">
          <div class="rivalry-card" *ngFor="let rivalry of rivalries">
            <div class="vs">VS</div>
            <div class="drivers">
              <span class="driver">{{ rivalry.driver1 }}</span>
              <span class="vs-text">vs</span>
              <span class="driver">{{ rivalry.driver2 }}</span>
            </div>
            <div class="team">{{ rivalry.team }}</div>
            <div class="years">{{ rivalry.years }}</div>
            <p class="description">{{ rivalry.description }}</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .history-page { padding: 6rem 2rem 4rem; max-width: 1200px; margin: 0 auto; }
    .page-header { text-align: center; margin-bottom: 4rem; padding: 3rem 0; background: linear-gradient(135deg, #f8f8f8, #ffeaea); border-radius: 24px; }
    .page-header h1 { font-size: clamp(2.5rem, 6vw, 4rem); margin-bottom: 0.5rem; color: #1a1a1a; }
    .subtitle { color: #666; font-size: 1.25rem; }

    h2 { font-size: 2rem; margin: 3rem 0 2rem; color: #1a1a1a; border-left: 4px solid #e10600; padding-left: 1rem; }

    .timeline { position: relative; padding-left: 30px; }
    .timeline::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(to bottom, #e10600, #ff4444); border-radius: 2px; }
    .timeline-item { position: relative; padding: 1.5rem 2rem; margin-bottom: 2rem; background: #f8f8f8; border-radius: 16px; transition: transform 0.3s, box-shadow 0.3s; }
    .timeline-item:hover { transform: translateX(8px); box-shadow: 0 8px 30px rgba(225,6,0,0.15); }
    .timeline-item::before { content: ''; position: absolute; left: -38px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #e10600; border-radius: 50%; border: 4px solid #fff; box-shadow: 0 0 0 2px #e10600; }
    .timeline-year { font-size: 0.875rem; font-weight: 700; color: #e10600; text-transform: uppercase; letter-spacing: 2px; }
    .timeline-content h3 { font-size: 1.5rem; margin: 0.5rem 0; color: #1a1a1a; }
    .timeline-content p { color: #666; line-height: 1.6; }
    .timeline-content ul { margin-top: 1rem; padding-left: 1.5rem; color: #555; }
    .timeline-content li { margin-bottom: 0.5rem; }

    .stories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
    .story-card { background: #f8f8f8; border-radius: 16px; overflow: hidden; transition: transform 0.3s, box-shadow 0.3s; }
    .story-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
    .story-image { height: 180px; background: #e8e8e8; overflow: hidden; }
    .story-image img { width: 100%; height: 100%; object-fit: cover; }
    .story-content { padding: 1.5rem; }
    .story-content .year { font-size: 0.75rem; font-weight: 700; color: #e10600; text-transform: uppercase; }
    .story-content h3 { font-size: 1.25rem; margin: 0.5rem 0; color: #1a1a1a; }
    .story-content p { color: #666; font-size: 0.9rem; line-height: 1.5; }

    .rivalries-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; }
    .rivalry-card { background: #f8f8f8; border-radius: 16px; padding: 2rem; text-align: center; transition: transform 0.3s; position: relative; overflow: hidden; }
    .rivalry-card:hover { transform: translateY(-4px); }
    .rivalry-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #e10600; }
    .vs { font-size: 2rem; font-weight: 900; color: #e10600; margin-bottom: 1rem; }
    .drivers { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .drivers .driver { font-size: 1.25rem; font-weight: 700; color: #1a1a1a; }
    .vs-text { color: #999; font-size: 0.875rem; text-transform: uppercase; }
    .team { color: #666; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .years { color: #e10600; font-weight: 600; font-size: 0.875rem; margin-bottom: 1rem; }
    .description { color: #666; font-size: 0.9rem; line-height: 1.5; }

    @media (max-width: 768px) {
      .history-page { padding: 5rem 1rem 2rem; }
      .timeline { padding-left: 20px; }
      .timeline::before { left: -10px; }
      .timeline-item { padding: 1rem; }
      .timeline-item::before { left: -22px; }
      .stories-grid, .rivalries-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class HistoryComponent {
  timeline: TimelineEra[] = [
    {
      year: '1950s-1960s',
      title: 'The Beginning',
      description: 'The first Formula 1 World Championship kicked off in 1950 at Silverstone. An era of legendary drivers and pioneering machines.',
      highlights: ['First race: 1950 British GP at Silverstone', 'Giuseppe Farina wins inaugural title', 'Juan Manuel Fangio wins 5 championships', 'Mercedes dominates with Fangio']
    },
    {
      year: '1970s-1980s',
      title: 'The Aerodynamic Revolution',
      description: 'Ground effect cars changed F1 forever. Turbocharging arrived, and the first great rivalries emerged.',
      highlights: ['Ground effect aerodynamic cars', 'Lotus leads innovation', 'Niki Lauda\'s comeback story', 'Prost vs Senna rivalry begins']
    },
    {
      year: '1990s',
      title: 'The Modern Era',
      description: 'F1 became truly global with massive technological advances. Michael Schumacher wrote history.',
      highlights: ['Michael Schumacher\'s 7 titles', 'Active suspension era', 'Refueling banned in 1994', 'Williams vs McLaren battle']
    },
    {
      year: '2000s',
      title: 'The Hybrid Transition',
      description: 'Ferrari dominated with Schumacher, then the hybrid era began. The Brawn GP fairytale unfolded.',
      highlights: ['Schumacher wins 5 titles with Ferrari', 'Brawn GP wins double championship in 2009', 'Red Bull arrives with V8 engines', 'Jenson Button wins dramatic title']
    },
    {
      year: '2010s-Present',
      title: 'The Verstappen Era',
      description: 'The hybrid turbo era brought record-breaking performances and new legends.',
      highlights: ['Mercedes hybrid dominance', 'Hamilton equals Schumacher record', 'Max Verstappen\'s reign begins', 'Most competitive era yet']
    }
  ];

  stories: Story[] = [
    {
      id: 'brawn-gp',
      title: 'Brawn GP 2009',
      year: 2009,
      description: 'The greatest underdog story in F1. Honda withdrew, Ross Brawn bought the team for $1, and they won both championships in their debut season.',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Brawn_GP_BGP_001.jpg/800px-Brawn_GP_BGP_001.jpg'
    },
    {
      id: 'mclaren-1988',
      title: 'McLaren 1988',
      year: 1988,
      description: 'Prost vs Senna at McLaren. The legendary rivalry that defined an era, culminating in the Suzuka collision.',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/McLaren_MP4-4.jpg/800px-McLaren_MP4-4.jpg'
    },
    {
      id: 'ferrari-2004',
      title: 'Ferrari 2004',
      year: 2004,
      description: 'Michael Schumacher wins a record 13 races in a single season, cementing his legacy as one of the greatest.',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Ferrari_F2004_Michael_Schumacher.jpg/800px-Ferrari_F2004_Michael_Schumacher.jpg'
    },
    {
      id: 'brazil-2008',
      title: 'Brazil 2008',
      year: 2008,
      description: 'The most dramatic championship finale ever. Hamilton crashes on final lap, allowing Vettel to win - then loses title by 1 point.',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Interlagos_2008.jpg/800px-Interlagos_2008.jpg'
    }
  ];

  rivalries: Rivalry[] = [
    {
      id: 'senna-prost',
      driver1: 'Ayrton Senna',
      driver2: 'Alain Prost',
      years: '1988-1993',
      team: 'McLaren',
      description: 'The most legendary rivalry in F1. Three championship battles, famous collision at Suzuka 1989.'
    },
    {
      id: 'hamilton-verstappen',
      driver1: 'Lewis Hamilton',
      driver2: 'Max Verstappen',
      years: '2017-Present',
      team: 'Mercedes / Red Bull',
      description: 'Modern era\'s greatest battle. Wheel-to-wheel battles, controversial finishes, record-breaking pace.'
    },
    {
      id: 'schumacher-hakkinen',
      driver1: 'Michael Schumacher',
      driver2: 'Mika Hakkinen',
      years: '1998-2000',
      team: 'Ferrari / McLaren',
      description: 'Three epic championship battles. Spa 1998 crash, Suzuka 1999 - decided by reliability.'
    },
    {
      id: 'fangio-moss',
      driver1: 'Juan Manuel Fangio',
      driver2: 'Stirling Moss',
      years: '1954-1957',
      team: 'Various',
      description: 'Gentlemen vs gentleman. Moss never won a title but took on Fangio in inferior machinery.'
    },
    {
      id: 'mansell-piquet',
      driver1: 'Nigel Mansell',
      driver2: 'Nelson Piquet',
      years: '1986-1992',
      team: 'Williams',
      description: 'Fierce internal battle. 1986 championship showdown, 1987 title fight in the rain.'
    }
  ];

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'https://via.placeholder.com/400x300/f8f8f8/1a1a1a?text=F1+Story';
  }
}