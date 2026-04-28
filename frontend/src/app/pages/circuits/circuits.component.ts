import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Circuit } from '../../core/models/driver.model';
import { CircuitCardComponent } from '../../components/circuit-card/circuit-card.component';

@Component({
  selector: 'app-circuits',
  standalone: true,
  imports: [CommonModule, FormsModule, CircuitCardComponent],
  template: `
    <div class="circuits-page">
      <header class="page-header">
        <h1>Circuits</h1>
        <div class="search-box">
          <input 
            type="text" 
            [(ngModel)]="searchTerm" 
            (input)="filterCircuits()"
            placeholder="Search circuits..."
          >
        </div>
      </header>
      <div class="loading" *ngIf="isLoading">
        <p>Loading circuits...</p>
      </div>
      <div class="circuits-grid" *ngIf="!isLoading">
        <app-circuit-card 
          *ngFor="let circuit of filteredCircuits" 
          [circuit]="circuit"
        ></app-circuit-card>
      </div>
      <p class="no-results" *ngIf="!isLoading && filteredCircuits.length === 0">No circuits found</p>
    </div>
  `,
  styles: [`
    .circuits-page { padding: 6rem 2rem 4rem; max-width: 1400px; margin: 0 auto; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    h1 { color: #1a1a1a; font-size: 2.5rem; margin: 0; }
    .search-box input {
      background: #f8f8f8;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #1a1a1a;
      font-size: 1rem;
      width: 250px;
      transition: border-color 0.3s;
    }
    .search-box input:focus {
      outline: none;
      border-color: #e10600;
    }
    .circuits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 2rem;
    }
    .no-results {
      color: #666;
      text-align: center;
      grid-column: 1 / -1;
      padding: 4rem;
    }
    @media (max-width: 768px) {
      .circuits-page { padding: 5rem 1rem 2rem; }
      .page-header { flex-direction: column; align-items: stretch; }
      .search-box input { width: 100%; }
      .circuits-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; }
    }
  `]
})
export class CircuitsComponent implements OnInit {
  circuits: Circuit[] = [];
  filteredCircuits: Circuit[] = [];
  searchTerm = '';
  isLoading = true;
  private csvDataService = inject(CSVDataService);

  ngOnInit() {
    this.csvDataService.getCircuits().subscribe({
      next: (circuits) => {
        this.circuits = circuits;
        this.filteredCircuits = circuits;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load circuits', err);
        this.isLoading = false;
      }
    });
  }

  filterCircuits() {
    const term = this.searchTerm.toLowerCase();
    this.filteredCircuits = this.circuits.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.location?.toLowerCase().includes(term) ||
      c.country?.toLowerCase().includes(term)
    );
  }
}