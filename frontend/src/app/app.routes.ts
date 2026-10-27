import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Paddock — Formula 1 archive',
  },
  {
    path: 'standings',
    loadComponent: () => import('./pages/standings/standings.component').then((m) => m.StandingsComponent),
    title: 'Standings — Paddock',
  },
  {
    path: 'drivers',
    loadComponent: () => import('./pages/drivers/drivers.component').then((m) => m.DriversComponent),
    title: 'Drivers — Paddock',
  },
  {
    path: 'constructors',
    loadComponent: () => import('./pages/constructors/constructors.component').then((m) => m.ConstructorsComponent),
    title: 'Teams — Paddock',
  },
  {
    path: 'circuits',
    loadComponent: () => import('./pages/circuits/circuits.component').then((m) => m.CircuitsComponent),
    title: 'Circuits — Paddock',
  },
  {
    path: 'races',
    loadComponent: () => import('./pages/races/races.component').then((m) => m.RacesComponent),
    title: 'Races — Paddock',
  },
  {
    path: 'races/:id',
    loadComponent: () =>
      import('./pages/race-detail/race-detail.component').then((m) => m.RaceDetailComponent),
    title: 'Race — Paddock',
  },
  {
    path: 'live',
    loadComponent: () => import('./pages/live/live.component').then((m) => m.LiveComponent),
    title: 'Live timing — Paddock',
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history.component').then((m) => m.HistoryComponent),
    title: 'History — Paddock',
  },
  {
    path: 'rivalry',
    loadComponent: () => import('./features/rivalry/rivalry.component').then((m) => m.RivalryComponent),
    title: 'Rivalry — Paddock',
  },
  {
    path: 'credits',
    loadComponent: () => import('./pages/credits/credits.component').then((m) => m.CreditsComponent),
    title: 'Credits — Paddock',
  },
  // The timeline is now the first section of the history page.
  { path: 'timeline', redirectTo: 'history', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
