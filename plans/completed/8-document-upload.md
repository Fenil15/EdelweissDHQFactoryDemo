# Plan: Document upload — local filesystem + access control

> Source: issue 8
> Notion page: 36b876cd42cc80e08992c47564e48b41

## Goals

Add a document upload feature for vendor submissions, with files persisted on
the local filesystem and access controlled by RBAC. Backend exposes upload,
list, stream, and delete endpoints; frontend ships a standalone
`DocumentUploadComponent` (drag-or-click) plus a `DocumentService` for the
HTTP calls. The component is self-contained so step 6 of the wizard (owned by
issue #7) can drop it in via a simple import.

## Constraints / notes

- Document entity already exists from #4 (`id`, `submissionId`, `fileName`,
  `mimeType`, `sizeBytes`, `storagePath`, `uploadedAt`). Use as-is — no schema
  changes. `synchronize: true` is already on.
- Submission entity exists from #4 with `vendorId` + `status` columns; vendor
  ownership is checked via `Submission.vendorId === Vendor.userId == req.user.userId`
  through the Vendor table (Vendor has `userId` FK to User).
- Storage root: `STORAGE_DIR` env var, default `./uploads` (already set in
  `.env.test`). Per-submission subdir: `<STORAGE_DIR>/<submissionId>/`.
  Filename on disk: `<docId>.<ext>` (extension derived from validated MIME).
- MIME whitelist: `application/pdf`, `image/jpeg`, `image/png`. Verified by
  (a) Content-Type from multer AND (b) magic-number sniff on the first bytes
  of the buffer. Reject anything else with 415.
- Size cap: 5 MB. Enforce via multer `limits.fileSize` and (defense in depth)
  by checking buffer length after the fact. Reject with 413.
- multer mode: **memory storage** for the upload endpoint so we can run the
  magic-number sniff before any bytes hit disk, then `fs.writeFile` to the
  final path. Simpler cleanup on rejection (no temp file to unlink).
- `STORAGE_DIR` is created on boot if missing (`fs.mkdirSync(recursive)`).
  Already gitignored (`.gitignore` line `uploads/`).
- Tests use a temp directory under `os.tmpdir()`; `STORAGE_DIR` is overridden
  per-test-suite and torn down in `afterAll`.

## Backend endpoints

### POST /api/submissions/:id/documents

- Auth: `requireJwt`. Vendor can only upload to a submission whose
  `vendorId` belongs to them; checker/admin can upload to any (acceptance
  criteria doesn't restrict this, but for the form flow only vendors will
  upload — we still 403 a vendor uploading to another vendor's submission).
- multer single-file (`file` field), memory storage, `limits.fileSize =
5*1024*1024`.
- Multer's `fileSize` limit error → 413 `{ error: 'file_too_large' }`.
- MIME check: extension from `fileName`, declared `mimetype`, AND first-bytes
  sniff must all agree on one of pdf/jpeg/png. Else 415
  `{ error: 'unsupported_media_type' }`.
- On success: `mkdir -p <STORAGE_DIR>/<submissionId>`, write file as
  `<docId>.<ext>`, insert Document row, return 201 with
  `{ id, fileName, mimeType, sizeBytes, uploadedAt }`.

### GET /api/submissions/:id/documents

- Auth: `requireJwt`. Vendor: own submission only (else 403). Checker/admin:
  any. Returns `[{ id, fileName, mimeType, sizeBytes, uploadedAt }, ...]`.

### GET /api/documents/:id

- Auth: `requireJwt`. RBAC: vendor must own the parent submission; checker/
  admin allowed. 403 on mismatch, 404 if document missing.
- Streams the file with `Content-Type: <mimeType>` and
  `Content-Disposition: inline; filename="<fileName>"`. `Content-Length`
  from the row's `sizeBytes`.

### DELETE /api/documents/:id

- Auth: `requireJwt`. Vendor: must own parent submission. Checker/admin: also
  allowed (defensive; AC says "vendor-only while Draft" — we still allow
  staff to override but the path that matters for the wizard is vendor).
- Only allowed while parent `Submission.status === 'Draft'`. Else 409
  `{ error: 'submission_not_draft' }`.
- Deletes the row, then `fs.unlink` the file (best-effort — log + swallow
  ENOENT). 204 on success.

## Frontend

### DocumentService (`apps/frontend/src/app/core/documents/document.service.ts`)

- `uploadFile(submissionId, file)` → POST multipart `FormData` to
  `/api/submissions/:id/documents`. Returns the saved Document DTO.
- `listForSubmission(submissionId)` → GET `/api/submissions/:id/documents`.
- `deleteFile(documentId)` → DELETE `/api/documents/:id`.
- `downloadUrl(documentId)` → `/api/documents/:id` (helper).

### DocumentUploadComponent (`apps/frontend/src/app/features/documents/document-upload.component.ts`)

- Standalone Angular component. `@Input() submissionId!: string`.
- Drag-or-click drop zone (Tailwind, no extra deps). `input[type=file]`
  hidden behind a label for click. Drag events: `dragenter / dragleave / dragover /
drop` to handle drop and visual highlight.
- Client-side validation before calling the service:
  - Size > 5 MB → inline error, no upload.
  - MIME not in pdf/jpeg/png → inline error, no upload.
- Inline error display when the backend rejects (415 / 413 / etc.).
- List of uploaded documents (name, size, type) with a remove button per row
  that calls `deleteFile` then refreshes the list.
- Loads list via `listForSubmission` on `ngOnInit` if `submissionId` is set.
- No router / parent-component dependencies — drop-in.

## Gitignore / env

- `.gitignore` already has `uploads/` from #4 — verified, nothing to add.
- `.env.test` already has `STORAGE_DIR=./uploads`. No change needed for the
  test config, but the jest tests will override `STORAGE_DIR` to a temp dir
  per suite to avoid polluting the repo. Document this in the test file.

## TDD slices (red → green)

Backend (Jest + supertest, real Postgres):

1. POST without JWT → 401.
2. POST with vendor JWT on another vendor's submission → 403.
3. POST with PDF under 5 MB by owning vendor → 201, row exists, file on disk
   at `<STORAGE_DIR>/<submissionId>/<docId>.pdf`.
4. POST with `.exe`/octet-stream → 415, no row, no file written.
5. POST with 6 MB file → 413, no row, no file written.
6. GET `/api/documents/:id` by owning vendor → 200, body bytes match, correct
   Content-Type.
7. GET `/api/documents/:id` by a _different_ vendor → 403.
8. GET `/api/documents/:id` by a checker → 200.
9. GET `/api/submissions/:id/documents` lists rows for owner / 403 for stranger.
10. DELETE `/api/documents/:id` on Draft → 204, file removed, row removed.
11. DELETE `/api/documents/:id` on In-Process → 409, row + file untouched.

Frontend (Jest):

12. `DocumentService.uploadFile` posts FormData with the file under field
    `file` to the right URL.
13. `DocumentService.listForSubmission` GETs the right URL.
14. `DocumentService.deleteFile` DELETEs the right URL.
15. `DocumentUploadComponent` renders empty state when no docs.
16. Picking a valid PDF calls `uploadFile` and shows it in the list.
17. Picking an `.exe` does NOT call `uploadFile`; shows inline error.
18. Picking a 6 MB file does NOT call `uploadFile`; shows inline error.
19. Backend 415 / 413 errors surface as inline component error messages.
20. Clicking remove calls `deleteFile` and refreshes the list.

## Out of scope

- Wiring into the multi-step form (owned by #7).
- Antivirus / deep PDF inspection — magic-number sniff is the agreed POC bar.
- S3 / object storage — local FS only.
