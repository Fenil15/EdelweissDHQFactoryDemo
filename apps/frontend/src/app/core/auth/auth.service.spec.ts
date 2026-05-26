import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('requestOtp posts to /api/auth/request-otp', () => {
    service.requestOtp('a@example.com').subscribe();
    const req = httpMock.expectOne('/api/auth/request-otp');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@example.com' });
    req.flush({ ok: true });
  });

  it('verifyOtp stores token in localStorage on success', () => {
    // Token with payload { userId: "u1", role: "vendor" } — header.signature are dummy.
    const payload = btoa(JSON.stringify({ userId: 'u1', role: 'vendor' }));
    const token = `h.${payload}.s`;

    service.verifyOtp('a@example.com', '123456').subscribe();
    const req = httpMock.expectOne('/api/auth/verify-otp');
    expect(req.request.body).toEqual({ email: 'a@example.com', otp: '123456' });
    req.flush({ token, role: 'vendor', userId: 'u1' });

    expect(service.token()).toBe(token);
    expect(service.roleFromToken()).toBe('vendor');
    expect(localStorage.getItem('auth.token')).toBe(token);
  });

  it('logout clears stored token', () => {
    localStorage.setItem('auth.token', 'h.payload.s');
    service.logout();
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('auth.token')).toBeNull();
  });
});
