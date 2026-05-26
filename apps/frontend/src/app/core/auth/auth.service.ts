import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type UserRole = 'vendor' | 'checker' | 'admin';

export interface VerifyOtpResponse {
  token: string;
  role: UserRole;
  userId: string;
}

export interface InviteResponse {
  id: string;
  email: string;
  role: UserRole;
}

const TOKEN_KEY = 'auth.token';

/**
 * Minimal client-side auth: talks to the backend's /api/auth endpoints and
 * caches the JWT in localStorage. The token signal is the source of truth for
 * the rest of the app (guards, interceptor, login redirect).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenSignal = signal<string | null>(this.readToken());

  /** Reactive read of the current token (or null). */
  readonly token = this.tokenSignal.asReadonly();

  requestOtp(email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>('/api/auth/request-otp', { email });
  }

  verifyOtp(email: string, otp: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>('/api/auth/verify-otp', { email, otp }).pipe(
      tap((res) => {
        this.storeToken(res.token);
      }),
    );
  }

  invite(email: string, role: UserRole): Observable<InviteResponse> {
    return this.http.post<InviteResponse>('/api/auth/invite', { email, role });
  }

  logout(): void {
    this.storeToken(null);
  }

  /** Decode the `role` claim out of the current JWT, or null if absent/invalid. */
  roleFromToken(): UserRole | null {
    const t = this.tokenSignal();
    if (!t) return null;
    const parts = t.split('.');
    if (parts.length < 2) return null;
    try {
      const payload = JSON.parse(this.b64UrlDecode(parts[1])) as { role?: UserRole };
      return payload.role ?? null;
    } catch {
      return null;
    }
  }

  private readToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private storeToken(token: string | null): void {
    if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
    this.tokenSignal.set(token);
  }

  private b64UrlDecode(input: string): string {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const fill = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return atob(padded + fill);
  }
}
