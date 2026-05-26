import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { SubmissionTimelineComponent } from './submission-timeline.component';

describe('SubmissionTimelineComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmissionTimelineComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 's42' })) },
        },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('renders audit-trail entries in the order returned', () => {
    const fixture = TestBed.createComponent(SubmissionTimelineComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/submissions/s42/audit');
    req.flush([
      {
        id: 'a1',
        submissionId: 's42',
        action: 'submit',
        fromStatus: 'Draft',
        toStatus: 'In-Process',
        comments: null,
        actorUserId: 'u1',
        actorEmail: 'v@example.com',
        createdAt: '2026-05-25T10:00:00Z',
      },
      {
        id: 'a2',
        submissionId: 's42',
        action: 'approve',
        fromStatus: 'In-Process',
        toStatus: 'Completed',
        comments: 'ok',
        actorUserId: 'u2',
        actorEmail: 'c@example.com',
        createdAt: '2026-05-25T11:00:00Z',
      },
    ]);
    fixture.detectChanges();

    const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="timeline-entry"]',
    );
    expect(items.length).toBe(2);

    const first = (items[0].textContent ?? '').trim();
    expect(first).toContain('submit');
    expect(first).toContain('Draft');
    expect(first).toContain('In-Process');
    expect(first).toContain('v@example.com');

    const second = (items[1].textContent ?? '').trim();
    expect(second).toContain('approve');
    expect(second).toContain('ok');
    expect(second).toContain('c@example.com');
  });

  it('renders an empty-state when there are no audit entries', () => {
    const fixture = TestBed.createComponent(SubmissionTimelineComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/submissions/s42/audit').flush([]);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('[data-testid="timeline-empty"]');
    expect(empty).toBeTruthy();
  });
});
