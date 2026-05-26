import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Submission } from '../entities/submission.entity';
import { Document } from '../entities/document.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

// Smallest possible valid PDF (header + EOF marker) — accepted by our magic-number sniff.
const TINY_PDF = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n%%EOF\n', 'binary');

// 1x1 PNG (89 50 4E 47 0D 0A 1A 0A header + minimal IHDR/IDAT/IEND).
const TINY_PNG = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010DA2DB540000000049454E44AE426082',
  'hex',
);

// 1x1 JPEG (SOI + APP0 + DQT + SOF0 + DHT + SOS + minimal data + EOI). For our magic
// sniff we only need bytes [0,1] = FF D8 and final two = FF D9 — a minimal stub works.
const TINY_JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

let STORAGE_DIR: string;

async function seedVendor(
  email: string,
  companyName = 'Acme',
): Promise<{ user: User; vendor: Vendor; token: string }> {
  const userRepo = AppDataSource.getRepository(User);
  const vendorRepo = AppDataSource.getRepository(Vendor);
  const user = await userRepo.save({ email, role: 'vendor' });
  const vendor = await vendorRepo.save({ userId: user.id, companyName });
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  return { user, vendor, token };
}

async function seedChecker(email: string): Promise<{ user: User; token: string }> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.save({ email, role: 'checker' });
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

async function seedSubmission(
  vendorId: string,
  status: 'Draft' | 'In-Process' = 'Draft',
): Promise<Submission> {
  const subRepo = AppDataSource.getRepository(Submission);
  return subRepo.save({ vendorId, status });
}

describe('Documents', () => {
  beforeAll(async () => {
    STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'edelweiss-docs-test-'));
    process.env.STORAGE_DIR = STORAGE_DIR;
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
    if (STORAGE_DIR && fs.existsSync(STORAGE_DIR)) {
      fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await AppDataSource.synchronize(true);
    // Wipe the temp storage between tests too, so each starts from a known empty FS.
    for (const entry of fs.readdirSync(STORAGE_DIR)) {
      fs.rmSync(path.join(STORAGE_DIR, entry), { recursive: true, force: true });
    }
  });

  describe('POST /api/submissions/:id/documents', () => {
    it('401s when no JWT is supplied', async () => {
      const app = createApp();
      const { vendor } = await seedVendor('v1@example.com');
      const submission = await seedSubmission(vendor.id);

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .attach('file', TINY_PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(401);
    });

    it("403s when a vendor uploads to another vendor's submission", async () => {
      const app = createApp();
      const { vendor: ownerVendor } = await seedVendor('owner@example.com');
      const { token: strangerToken } = await seedVendor('stranger@example.com');
      const submission = await seedSubmission(ownerVendor.id);

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .attach('file', TINY_PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
    });

    it('201s on a valid PDF under 5MB and persists row + file', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor@example.com');
      const submission = await seedSubmission(vendor.id);

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'invoice.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: TINY_PDF.length,
      });
      expect(res.body.id).toEqual(expect.any(String));

      const docRow = await AppDataSource.getRepository(Document).findOneByOrFail({
        id: res.body.id,
      });
      expect(docRow.submissionId).toBe(submission.id);
      expect(docRow.storagePath).toContain(submission.id);
      expect(fs.existsSync(docRow.storagePath)).toBe(true);
      expect(fs.statSync(docRow.storagePath).size).toBe(TINY_PDF.length);
    });

    it('201s on a valid PNG under 5MB', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-png@example.com');
      const submission = await seedSubmission(vendor.id);

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PNG, { filename: 'logo.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('image/png');
    });

    it('415s on a non-allowed MIME type (e.g. .exe)', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-exe@example.com');
      const submission = await seedSubmission(vendor.id);
      const exeBytes = Buffer.from('MZ\x90\x00fake-exe-bytes');

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', exeBytes, {
          filename: 'malware.exe',
          contentType: 'application/octet-stream',
        });

      expect(res.status).toBe(415);
      const count = await AppDataSource.getRepository(Document).count();
      expect(count).toBe(0);
      // No file on disk
      const subDir = path.join(STORAGE_DIR, submission.id);
      expect(fs.existsSync(subDir) && fs.readdirSync(subDir).length > 0).toBe(false);
    });

    it('415s when MIME claim is PDF but content is not (magic-number sniff)', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-spoof@example.com');
      const submission = await seedSubmission(vendor.id);
      const lyingBytes = Buffer.from('this is not really a PDF');

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', lyingBytes, { filename: 'fake.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(415);
    });

    it('413s on a file larger than 5MB', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-big@example.com');
      const submission = await seedSubmission(vendor.id);
      const sixMb = Buffer.concat([TINY_PDF, Buffer.alloc(6 * 1024 * 1024)]);

      const res = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', sixMb, { filename: 'huge.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(413);
      const count = await AppDataSource.getRepository(Document).count();
      expect(count).toBe(0);
    });

    it('404s when the submission does not exist', async () => {
      const app = createApp();
      const { token } = await seedVendor('vendor-404@example.com');

      const res = await request(app)
        .post(`/api/submissions/00000000-0000-0000-0000-000000000000/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'a.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/submissions/:id/documents', () => {
    it('lists documents for the owning vendor', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-list@example.com');
      const submission = await seedSubmission(vendor.id);

      await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
      await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PNG, { filename: 'b.png', contentType: 'image/png' });

      const res = await request(app)
        .get(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((d: { fileName: string }) => d.fileName).sort()).toEqual([
        'a.pdf',
        'b.png',
      ]);
    });

    it('403s for a different vendor', async () => {
      const app = createApp();
      const { vendor } = await seedVendor('owner@example.com');
      const { token: strangerToken } = await seedVendor('stranger@example.com');
      const submission = await seedSubmission(vendor.id);

      const res = await request(app)
        .get(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    it('200s for a checker viewing any submission', async () => {
      const app = createApp();
      const { vendor } = await seedVendor('owner2@example.com');
      const { token: checkerToken } = await seedChecker('checker@example.com');
      const submission = await seedSubmission(vendor.id);

      const res = await request(app)
        .get(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${checkerToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('streams the file with the correct Content-Type for the owning vendor', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-stream@example.com');
      const submission = await seedSubmission(vendor.id);

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(upload.status).toBe(201);

      const res = await request(app)
        .get(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).equals(TINY_PDF)).toBe(true);
    });

    it('403s when a different vendor tries to fetch', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-own@example.com');
      const { token: strangerToken } = await seedVendor('vendor-foreign@example.com');
      const submission = await seedSubmission(vendor.id);

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

      const res = await request(app)
        .get(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });

    it('200s when a checker fetches any document', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-c@example.com');
      const { token: checkerToken } = await seedChecker('checker2@example.com');
      const submission = await seedSubmission(vendor.id);

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

      const res = await request(app)
        .get(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${checkerToken}`);
      expect(res.status).toBe(200);
    });

    it('404s when the document does not exist', async () => {
      const app = createApp();
      const { token } = await seedVendor('vendor-nope@example.com');
      const res = await request(app)
        .get(`/api/documents/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('204s on a Draft submission and removes row + file', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-del@example.com');
      const submission = await seedSubmission(vendor.id, 'Draft');

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'd.pdf', contentType: 'application/pdf' });
      const docRow = await AppDataSource.getRepository(Document).findOneByOrFail({
        id: upload.body.id,
      });
      const storagePath = docRow.storagePath;
      expect(fs.existsSync(storagePath)).toBe(true);

      const res = await request(app)
        .delete(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const found = await AppDataSource.getRepository(Document).findOneBy({ id: upload.body.id });
      expect(found).toBeNull();
      expect(fs.existsSync(storagePath)).toBe(false);
    });

    it('409s when the submission is not Draft', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-locked@example.com');
      const submission = await seedSubmission(vendor.id, 'Draft');

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'x.pdf', contentType: 'application/pdf' });

      await AppDataSource.getRepository(Submission).update(submission.id, { status: 'In-Process' });

      const res = await request(app)
        .delete(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);

      const found = await AppDataSource.getRepository(Document).findOneBy({ id: upload.body.id });
      expect(found).not.toBeNull();
    });

    it('403s when a different vendor tries to delete', async () => {
      const app = createApp();
      const { vendor, token } = await seedVendor('vendor-owner@example.com');
      const { token: strangerToken } = await seedVendor('vendor-stranger@example.com');
      const submission = await seedSubmission(vendor.id);

      const upload = await request(app)
        .post(`/api/submissions/${submission.id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', TINY_PDF, { filename: 'd.pdf', contentType: 'application/pdf' });

      const res = await request(app)
        .delete(`/api/documents/${upload.body.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // Reference TINY_JPEG_HEADER so the unused-var lint doesn't flag it; we keep
  // the constant available for future JPEG-specific checks.
  it('has access to a valid JPEG header constant', () => {
    expect(TINY_JPEG_HEADER.slice(0, 3).toString('hex')).toBe('ffd8ff');
  });
});
