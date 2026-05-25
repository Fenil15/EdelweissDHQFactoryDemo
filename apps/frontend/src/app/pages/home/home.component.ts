import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

interface HealthResponse {
  status: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly status = signal('loading…');

  ngOnInit(): void {
    this.http.get<HealthResponse>('/api/health').subscribe({
      next: (data) => {
        this.status.set(data?.status ?? 'unknown');
      },
      error: () => {
        this.status.set('error');
      },
    });
  }
}
