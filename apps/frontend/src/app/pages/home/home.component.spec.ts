import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  it('renders backend status from /api/health', async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const httpMock = TestBed.inject(HttpTestingController);
    const req = httpMock.expectOne('/api/health');
    req.flush({ status: 'ok' });
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="health-status"]');
    expect(el.textContent.trim()).toBe('ok');
  });
});
