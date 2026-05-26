import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

type Step = 'email' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="max-w-sm mx-auto p-6 space-y-4">
      <h1 class="text-2xl font-semibold">Sign in</h1>

      @if (step() === 'email') {
        <label class="block">
          <span class="text-sm text-gray-600">Email</span>
          <input
            type="email"
            class="w-full border rounded px-2 py-1"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
            data-testid="email-input"
            autocomplete="email"
          />
        </label>
        <button
          class="w-full bg-brand hover:bg-brand-dark text-white rounded px-3 py-2 disabled:opacity-50"
          [disabled]="pending()"
          (click)="onRequestOtp()"
          data-testid="request-otp-btn"
        >
          {{ pending() ? 'Sending…' : 'Send OTP' }}
        </button>
      }

      @if (step() === 'otp') {
        <p class="text-sm text-gray-600">
          We sent a 6-digit code to <strong>{{ email() }}</strong
          >.
        </p>
        <label class="block">
          <span class="text-sm text-gray-600">OTP</span>
          <input
            type="text"
            inputmode="numeric"
            maxlength="6"
            class="w-full border rounded px-2 py-1 tracking-widest"
            [value]="otp()"
            (input)="otp.set($any($event.target).value)"
            data-testid="otp-input"
          />
        </label>
        <button
          class="w-full bg-brand hover:bg-brand-dark text-white rounded px-3 py-2 disabled:opacity-50"
          [disabled]="pending()"
          (click)="onVerifyOtp()"
          data-testid="verify-otp-btn"
        >
          {{ pending() ? 'Verifying…' : 'Verify' }}
        </button>
        <button
          class="w-full text-sm text-gray-600 underline"
          (click)="step.set('email')"
          data-testid="back-btn"
        >
          Use a different email
        </button>
      }

      @if (error()) {
        <p class="text-sm text-red-600" data-testid="login-error">{{ error() }}</p>
      }
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly step = signal<Step>('email');
  readonly email = signal('');
  readonly otp = signal('');
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);

  onRequestOtp(): void {
    if (!this.email()) {
      this.error.set('Email is required.');
      return;
    }
    this.error.set(null);
    this.pending.set(true);
    this.auth.requestOtp(this.email()).subscribe({
      next: () => {
        this.pending.set(false);
        this.otp.set('');
        this.step.set('otp');
      },
      error: () => {
        this.pending.set(false);
        this.error.set('Could not send OTP. Try again.');
      },
    });
  }

  onVerifyOtp(): void {
    if (this.otp().length !== 6) {
      this.error.set('Enter the 6-digit code.');
      return;
    }
    this.error.set(null);
    this.pending.set(true);
    this.auth.verifyOtp(this.email(), this.otp()).subscribe({
      next: (res) => {
        this.pending.set(false);
        // Token is already stored by AuthService; redirect by role claim.
        this.router.navigateByUrl(`/${res.role}`);
      },
      error: (err) => {
        this.pending.set(false);
        this.error.set(
          err?.status === 423
            ? 'Account locked due to too many attempts. Try again in 5 minutes.'
            : 'Invalid or expired OTP.',
        );
      },
    });
  }
}
