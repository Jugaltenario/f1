import { Injectable, inject, signal, computed } from '@angular/core';
import { CSVDataService } from '../services/csv-data.service';
import { Driver } from '../models/driver.model';

export type DriverFilter = 'all' | 'active' | 'legend';

@Injectable({ providedIn: 'root' })
export class DriverStateService {
  private csvDataService = inject(CSVDataService);

  readonly drivers = signal<Driver[]>([]);
  readonly searchTerm = signal<string>('');
  readonly filterType = signal<DriverFilter>('all');
  readonly selectedNationality = signal<string>('all');
  readonly selectedDriver = signal<Driver | null>(null);
  readonly isLoading = signal<boolean>(true);

  readonly nationalities = computed(() => {
    const nats = new Set(this.drivers().map(d => d.nationality));
    return ['all', ...Array.from(nats).sort()];
  });

  readonly filteredDrivers = computed(() => {
    let result = this.drivers();
    const search = this.searchTerm().toLowerCase();
    const filter = this.filterType();
    const nationality = this.selectedNationality();

    if (search) {
      result = result.filter(d => 
        d.forename.toLowerCase().includes(search) ||
        d.surname.toLowerCase().includes(search) ||
        d.code?.toLowerCase().includes(search) ||
        d.nationality.toLowerCase().includes(search)
      );
    }

    if (filter === 'active') {
      result = result.filter(d => (d.wins || 0) < 50);
    } else if (filter === 'legend') {
      result = result.filter(d => (d.wins || 0) >= 50);
    }

    if (nationality !== 'all') {
      result = result.filter(d => d.nationality === nationality);
    }

    return result;
  });

  readonly championCount = computed(() => {
    return new Map(
      this.drivers()
        .filter(d => (d.wins || 0) >= 30)
        .sort((a, b) => (b.wins || 0) - (a.wins || 0))
         .map(d => [d.driverId, d])
    );
  });

  loadDrivers() {
    this.isLoading.set(true);
    this.csvDataService.getDriverStats().subscribe({
      next: (drivers) => {
        this.drivers.set(drivers);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setSearch(term: string) {
    this.searchTerm.set(term);
  }

  setFilter(filter: DriverFilter) {
    this.filterType.set(filter);
  }

  setNationality(nationality: string) {
    this.selectedNationality.set(nationality);
  }

  selectDriver(driver: Driver) {
    this.selectedDriver.set(driver);
  }

  clearSelection() {
    this.selectedDriver.set(null);
  }
}