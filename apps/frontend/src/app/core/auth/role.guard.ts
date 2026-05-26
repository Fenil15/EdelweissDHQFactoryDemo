import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService, type UserRole } from './auth.service';

/**
 * Route guard factory — allows the route when the current JWT's role claim
 * is in `allowed`. If there is no token, redirects to /login (mirrors
 * `authGuard`); if there is a token but the role doesn't match, sends the
 * user back to / (i.e. "you're logged in, just not for this page").
 */
export function roleGuard(allowed: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.token()) return router.parseUrl('/login');
    const role = auth.roleFromToken();
    if (role && allowed.includes(role)) return true;
    return router.parseUrl('/');
  };
}
