// Simple Express backend for ExamTracker
// Provides a real upload endpoint and static file serving for PDFs.

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { authMiddleware, rateLimitMiddleware, requireJson } = require('./lib/security');
const { ExamsStore } = require('./lib/store');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 50));

async function ensureUploadDir() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeName(name) {
  return String(name || 'upload.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Multer storage for multipart/form-data
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const q = req.query || {};
    const id = (q.id || '').toString();
    const original = sanitizeName((q.filename || file.originalname || 'upload.pdf').toString());
    const name = (id ? `${id}-` : '') + original;
    cb(null, name);
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = (file.mimetype || '').toLowerCase() === 'application/pdf';
    if (!ok) return cb(new Error('Only application/pdf allowed'));
    cb(null, true);
  }
});

async function main() {
  await ensureUploadDir();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(rateLimitMiddleware());
  const store = new ExamsStore();

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Serve static uploads
  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '30d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Optionally serve built frontend if available
  const buildDir = path.resolve(process.cwd(), 'build');
  if (fs.existsSync(buildDir)) {
    app.use('/', express.static(buildDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(buildDir, 'index.html'));
    });
  }

  // Accept raw PDF body (Content-Type: application/pdf)
  app.post('/api/upload', express.raw({ type: 'application/pdf', limit: `${MAX_UPLOAD_MB}mb` }), async (req, res, next) => {
    try {
      if (!req.is('application/pdf')) return next(); // fallthrough to multer
      const q = req.query || {};
      const id = (q.id || '').toString();
      const original = sanitizeName((q.filename || 'upload.pdf').toString());
      const name = (id ? `${id}-` : '') + original;
      const filePath = path.join(UPLOAD_DIR, name);
      // Basic signature sniff: %PDF-
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ ok: false, error: 'Invalid body' });
      }
      const sig = req.body.subarray(0, 5).toString('utf8');
      if (sig !== '%PDF-') {
        return res.status(415).json({ ok: false, error: 'Invalid file type (expected PDF)' });
      }
      await fsp.writeFile(filePath, req.body);
      return res.json({ ok: true, path: `/uploads/${name}` });
    } catch (err) {
      console.error('Raw upload error:', err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Accept multipart form data (file field = 'file')
  app.post('/api/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const rel = `/uploads/${path.basename(file.path)}`;
    res.json({ ok: true, path: rel });
  });

  // JSON body parser for API
  app.use(express.json({ limit: '1mb' }));
  app.use(authMiddleware());

  // Sanitize input to avoid storing blobs or unwanted fields
  function sanitizeExamPayload(payload) {
    const allowed = [
      'id','fileName','fileUrl','uploadDate','examDate','courseName','courseCode','year','totalPoints','questions','extractedText','tags','archived'
    ];
    const out = {};
    for (const k of allowed) if (k in payload) out[k] = payload[k];
    // Never allow binary blobs
    delete out.fileBlob;
    // Normalize dates to ISO strings
    if (out.uploadDate instanceof Date) out.uploadDate = out.uploadDate.toISOString();
    if (out.examDate instanceof Date) out.examDate = out.examDate.toISOString();
    return out;
  }

  // List exams
  app.get('/api/exams', async (_req, res) => {
    const items = await store.list();
    res.json({ ok: true, items });
  });

  // Get one
  app.get('/api/exams/:id', async (req, res) => {
    const it = await store.get(req.params.id);
    if (!it) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: it });
  });

  // Create
  app.post('/api/exams', requireJson(), async (req, res) => {
    const payload = sanitizeExamPayload(req.body || {});
    try {
      const created = await store.create(payload);
      res.status(201).json({ ok: true, item: created });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err) });
    }
  });

  // Update/Upsert
  app.put('/api/exams/:id', requireJson(), async (req, res) => {
    const id = req.params.id;
    const payload = sanitizeExamPayload(req.body || {});
    try {
      const updated = await store.update(id, payload);
      res.json({ ok: true, item: updated });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err) });
    }
  });

  // Delete
  app.delete('/api/exams/:id', async (req, res) => {
    const id = req.params.id;
    const delFile = String(req.query.deleteFile || '0') === '1';
    const item = await store.get(id);
    if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
    await store.remove(id);
    if (delFile) {
      try {
        const maybe = item.fileUrl || item.path || item.filePath;
        if (typeof maybe === 'string' && maybe.startsWith('/uploads/')) {
          const p = path.join(UPLOAD_DIR, path.basename(maybe));
          await fsp.unlink(p).catch(() => {});
        }
      } catch {}
    }
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
