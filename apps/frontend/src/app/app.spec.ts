import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  it('renders a global header containing the Edelweiss logo', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const header: HTMLElement | null = fixture.nativeElement.querySelector('header');
    expect(header).toBeTruthy();

    const img = header?.querySelector('img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')?.toLowerCase()).toContain('edelweiss');
  });
});
