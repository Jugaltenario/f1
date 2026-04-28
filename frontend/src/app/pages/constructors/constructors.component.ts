import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CSVDataService } from '../../core/services/csv-data.service';
import { Constructor } from '../../core/models/driver.model';
import { ConstructorCardComponent } from '../../components/constructor-card/constructor-card.component';

@Component({
  selector: 'app-constructors',
  standalone: true,
  imports: [CommonModule, FormsModule, ConstructorCardComponent],
  template: `
    <div class="constructors-page">
      <header class="page-header">
        <h1>Constructors</h1>
        <div class="search-box">
          <input 
            type="text" 
            [(ngModel)]="searchTerm" 
            (input)="filterConstructors()"
            placeholder="Search teams..."
          >
        </div>
      </header>
      <div class="loading" *ngIf="isLoading">
        <p>Loading constructors...</p>
      </div>
      <div class="constructors-grid" *ngIf="!isLoading">
        <app-constructor-card 
          *ngFor="let constructor of filteredConstructors" 
          [team]="constructor"
        ></app-constructor-card>
      </div>
      <p class="no-results" *ngIf="!isLoading && filteredConstructors.length === 0">No constructors found</p>
    </div>
  `,
  styles: [`
    .constructors-page { padding: 6rem 2rem 4rem; max-width: 1400px; margin: 0 auto; }
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
    .constructors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 2rem;
    }
    .no-results {
      color: #666;
      text-align: center;
      grid-column: 1 / -1;
      padding: 4rem;
    }
    @media (max-width: 768px) {
      .constructors-page { padding: 5rem 1rem 2rem; }
      .page-header { flex-direction: column; align-items: stretch; }
      .search-box input { width: 100%; }
      .constructors-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }
    }
  `]
})
export class ConstructorsComponent implements OnInit {
  constructors: Constructor[] = [];
  filteredConstructors: Constructor[] = [];
  searchTerm = '';
  isLoading = true;
  private csvDataService = inject(CSVDataService);

  ngOnInit() {
    this.csvDataService.getConstructors().subscribe({
      next: (constructors) => {
        this.constructors = constructors;
        this.filteredConstructors = constructors;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load constructors', err);
        this.isLoading = false;
      }
    });
  }

  filterConstructors() {
    const term = this.searchTerm.toLowerCase();
    this.filteredConstructors = this.constructors.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.nationality?.toLowerCase().includes(term)
    );
  }
}