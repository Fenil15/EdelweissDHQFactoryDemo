import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';

class StubAuthService {
  role: 'vendor' | 'checker' | 'admin' | null = null;
  token(): string | null {
    return this.role ? 'tok' : null;
  }
  roleFromToken(): 'vendor' | 'checker' | 'admin' | null {
    return this.role;
  }
}

describe('roleGuard', () => {
  let auth: StubAuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useClass: StubAuthService }],
    });
    auth = TestBed.inject(AuthService) as unknown as StubAuthService;
    router = TestBed.inject(Router);
  });

  function invoke(allowed: Array<'vendor' | 'checker' | 'admin'>) {
    return TestBed.runInInjectionContext(() =>
      roleGuard(allowed)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('allows when current role is in the allow-list', () => {
    auth.role = 'admin';
    expect(invoke(['admin'])).toBe(true);
  });

  it('redirects to / when role is not in the allow-list', () => {
    auth.role = 'vendor';
    const result = invoke(['admin']);
    expect(result).toEqual(router.parseUrl('/'));
  });

  it('redirects to /login when there is no token at all', () => {
    auth.role = null;
    const result = invoke(['checker', 'admin']);
    expect(result).toEqual(router.parseUrl('/login'));
  });
});
