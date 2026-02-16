import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/calendar',
    pathMatch: 'full'
  },
  {
    path: 'calendar',
    loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent)
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.component').then(m => m.ImportComponent)
  },
  {
    path: '**',
    redirectTo: '/calendar'
  }
];
