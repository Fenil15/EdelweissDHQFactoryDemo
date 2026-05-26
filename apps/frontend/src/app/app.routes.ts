import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

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
    path: 'vendor/submissions/:id/timeline',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/submission-timeline/submission-timeline.component').then(
        (m) => m.SubmissionTimelineComponent,
      ),
  },
  {
    path: 'checker',
    canActivate: [authGuard, roleGuard(['checker', 'admin'])],
    loadComponent: () =>
      import('./pages/checker-dashboard/checker-dashboard.component').then(
        (m) => m.CheckerDashboardComponent,
      ),
  },
  {
    path: 'checker/:id',
    canActivate: [authGuard, roleGuard(['checker', 'admin'])],
    loadComponent: () =>
      import('./pages/checker-submission-detail/checker-submission-detail.component').then(
        (m) => m.CheckerSubmissionDetailComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'audit',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./pages/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  },
  { path: '**', redirectTo: '' },
];
