import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/vendor-dashboard/vendor-dashboard.component').then(
        (m) => m.VendorDashboardComponent,
      ),
  },
  {
    path: 'vendor/submissions/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/submission-form/submission-form.component').then(
        (m) => m.SubmissionFormComponent,
      ),
  },
  {
    path: 'checker',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/checker-dashboard/checker-dashboard.component').then(
        (m) => m.CheckerDashboardComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'audit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  { path: '**', redirectTo: '' },
];
