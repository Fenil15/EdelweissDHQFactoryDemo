import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'vendor',
    loadComponent: () =>
      import('./pages/vendor-dashboard/vendor-dashboard.component').then(
        (m) => m.VendorDashboardComponent,
      ),
  },
  {
    path: 'checker',
    loadComponent: () =>
      import('./pages/checker-dashboard/checker-dashboard.component').then(
        (m) => m.CheckerDashboardComponent,
      ),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  { path: '**', redirectTo: '' },
];
