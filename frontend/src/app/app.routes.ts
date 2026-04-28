import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DriversComponent } from './pages/drivers/drivers.component';
import { ConstructorsComponent } from './pages/constructors/constructors.component';
import { CircuitsComponent } from './pages/circuits/circuits.component';
import { RacesComponent } from './pages/races/races.component';
import { HistoryComponent } from './pages/history/history.component';
import { RivalryComponent } from './features/rivalry/rivalry.component';
import { TimelineComponent } from './features/timeline/timeline.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'timeline', component: TimelineComponent },
  { path: 'drivers', component: DriversComponent },
  { path: 'constructors', component: ConstructorsComponent },
  { path: 'circuits', component: CircuitsComponent },
  { path: 'races', component: RacesComponent },
  { path: 'rivalry', component: RivalryComponent },
  { path: '**', redirectTo: '' }
];