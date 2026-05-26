import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DocumentService, type DocumentDto } from '../../core/documents/document.service';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-or-click file upload widget tied to a single submission. Self-contained
 * — drop into any host page (e.g. step 6 of the vendor wizard) by setting
 * `[submissionId]`.
 *
 * Client-side validation rejects oversized files and non-PDF/JPEG/PNG MIME
 * types BEFORE hitting the server; server errors (415/413/etc) are also
 * surfaced inline.
 */
@Component({
  selector: 'app-document-upload',
  standalone: true,
  template: `
    <div class="space-y-4">
      <div
        class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
        [class.border-gray-300]="!isDragging()"
        [class.border-blue-500]="isDragging()"
        [class.bg-blue-50]="isDragging()"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        data-testid="dropzone"
      >
        <p class="text-sm text-gray-600">Drag a file here, or</p>
        <label
          class="inline-block mt-2 bg-brand text-white text-sm rounded px-3 py-1 cursor-pointer hover:bg-brand-dark"
        >
          Choose a file
          <input
            type="file"
            class="hidden"
            accept="application/pdf,image/jpeg,image/png"
            (change)="onFileSelected($event)"
            data-testid="file-input"
          />
        </label>
        <p class="text-xs text-gray-500 mt-2">PDF, JPG, or PNG. Max 5 MB.</p>
      </div>

      @if (error()) {
        <p class="text-sm text-red-600" data-testid="upload-error">{{ error() }}</p>
      }

      @if (uploading()) {
        <p class="text-sm text-gray-600" data-testid="upload-pending">Uploading…</p>
      }

      @if (documents().length === 0 && !uploading()) {
        <p class="text-sm text-gray-500 italic" data-testid="empty-state">
          No documents uploaded yet.
        </p>
      } @else {
        <ul class="divide-y border rounded" data-testid="doc-list">
          @for (doc of documents(); track doc.id) {
            <li class="flex items-center justify-between px-3 py-2" data-testid="doc-row">
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">{{ doc.fileName }}</p>
                <p class="text-xs text-gray-500">
                  {{ doc.mimeType }} · {{ formatSize(doc.sizeBytes) }}
                </p>
              </div>
              <button
                type="button"
                class="text-sm text-red-600 hover:underline"
                (click)="onRemove(doc.id)"
                data-testid="remove-btn"
              >
                Remove
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DocumentUploadComponent implements OnInit {
  @Input() submissionId: string | null = null;

  private readonly docService = inject(DocumentService);

  readonly documents = signal<DocumentDto[]>([]);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isDragging = signal(false);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (!this.submissionId) return;
    this.docService.listForSubmission(this.submissionId).subscribe({
      next: (docs) => this.documents.set(docs),
      error: () => {
        // Keep UI quiet on initial list failure — the upload UI is still usable.
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.handleFile(file);
    // Reset the input so the same file can be re-picked after a remove.
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onRemove(documentId: string): void {
    this.error.set(null);
    this.docService.deleteFile(documentId).subscribe({
      next: () => {
        this.documents.update((list) => list.filter((d) => d.id !== documentId));
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.errorMessage(err, 'Could not remove document.'));
      },
    });
  }

  formatSize(bytes: number): string {
    return humanSize(bytes);
  }

  private handleFile(file: File): void {
    if (!this.submissionId) {
      this.error.set('No submission selected.');
      return;
    }
    if (file.size > MAX_SIZE) {
      this.error.set('File is larger than 5 MB.');
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      this.error.set('Only PDF, JPG, or PNG files are allowed.');
      return;
    }

    this.error.set(null);
    this.uploading.set(true);
    this.docService.uploadFile(this.submissionId, file).subscribe({
      next: (doc) => {
        this.uploading.set(false);
        this.documents.update((list) => [...list, doc]);
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        this.error.set(this.errorMessage(err, 'Upload failed.'));
      },
    });
  }

  private errorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 413) return 'File is larger than 5 MB.';
    if (err.status === 415) return 'Only PDF, JPG, or PNG files are allowed.';
    if (err.status === 403) return 'You do not have permission to do that.';
    if (err.status === 409) return 'This submission can no longer be edited.';
    return fallback;
  }
}
