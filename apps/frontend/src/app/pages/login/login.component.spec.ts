import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';

import { LoginComponent } from './login.component';

function jwtFor(role: 'vendor' | 'checker' | 'admin'): string {
  const payload = btoa(JSON.stringify({ userId: 'u1', role }));
  return `h.${payload}.s`;
}

describe('LoginComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'login', component: LoginComponent },
          // Dummy stand-in components are unnecessary — we only assert URL.
          { path: 'vendor', component: LoginComponent },
          { path: 'checker', component: LoginComponent },
          { path: 'admin', component: LoginComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    await router.navigateByUrl('/login');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  async function runFlow(role: 'vendor' | 'checker' | 'admin', expectedPath: string) {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    // Step 1: enter email + submit
    const emailInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="email-input"]',
    );
    emailInput.value = 'u@example.com';
    emailInput.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('[data-testid="request-otp-btn"]').click();
    fixture.detectChanges();

    const req1 = httpMock.expectOne('/api/auth/request-otp');
    req1.flush({ ok: true });
    fixture.detectChanges();

    // Step 2: enter OTP + submit
    const otpInput: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="otp-input"]',
    );
    expect(otpInput).toBeTruthy();
    otpInput.value = '123456';
    otpInput.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('[data-testid="verify-otp-btn"]').click();
    fixture.detectChanges();

    const req2 = httpMock.expectOne('/api/auth/verify-otp');
    req2.flush({ token: jwtFor(role), role, userId: 'u1' });
    await fixture.whenStable();

    expect(location.path()).toBe(expectedPath);
  }

  it('vendor role → /vendor', async () => {
    await runFlow('vendor', '/vendor');
  });

  it('checker role → /checker', async () => {
    await runFlow('checker', '/checker');
  });

  it('admin role → /admin', async () => {
    await runFlow('admin', '/admin');
  });

  it('renders the primary "Send OTP" button with the Edelweiss brand color', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="request-otp-btn"]',
    );
    expect(button).toBeTruthy();
    expect(button.className).toContain('bg-brand');
  });
});
