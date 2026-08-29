const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const { saveClip, getClip, deleteClip, generateUniqueCode } = require('./lib/storage');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const isImage = req.file.mimetype.startsWith('image/');
  const fileUrl = `/uploads/${req.file.filename}`;

  return res.json({
    success: true,
    fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    isImage
  });
});

// REST API: Create Clip
app.post('/api/clip/create', async (req, res) => {
  try {
    const { type, content, language, fileName, fileSize, fileUrl, expiresInMinutes = 5 } = req.body || {};
    const validMinutes = [1, 5, 10].includes(Number(expiresInMinutes)) ? Number(expiresInMinutes) : 5;
    const ttlSeconds = validMinutes * 60;
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);
    const code = await generateUniqueCode();

    const clip = {
      code,
      type: type || 'text',
      content: content || '',
      language: language || (type === 'code' ? 'javascript' : null),
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileUrl: fileUrl || null,
      createdAt: now,
      expiresInMinutes: validMinutes,
      expiresAt
    };

    await saveClip(code, clip, ttlSeconds);
    res.json({ success: true, code, clip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REST API: Retrieve Clip by 4-digit code
app.get('/api/clip/:code', async (req, res) => {
  try {
    const code = req.params.code ? req.params.code.trim() : '';
    const clip = await getClip(code);

    if (!clip || (clip.expiresAt && clip.expiresAt <= Date.now())) {
      if (clip) await deleteClip(code);
      return res.status(404).json({ success: false, error: 'Clip not found or has expired.' });
    }

    res.json({ success: true, clip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.io Real-Time Layer (with direct create/fetch handlers)
io.on('connection', (socket) => {
  socket.on('watch_clip', ({ code }) => {
    if (code) socket.join(code);
  });

  socket.on('create_clip', async (payload, callback) => {
    try {
      const { type, content, language, fileName, fileSize, fileUrl, expiresInMinutes = 5 } = payload || {};
      const validMinutes = [1, 5, 10].includes(Number(expiresInMinutes)) ? Number(expiresInMinutes) : 5;
      const ttlSeconds = validMinutes * 60;
      const now = Date.now();
      const expiresAt = now + (ttlSeconds * 1000);
      const code = await generateUniqueCode();

      const clip = {
        code,
        type: type || 'text',
        content: content || '',
        language: language || (type === 'code' ? 'javascript' : null),
        fileName: fileName || null,
        fileSize: fileSize || null,
        fileUrl: fileUrl || null,
        createdAt: now,
        expiresInMinutes: validMinutes,
        expiresAt
      };

      await saveClip(code, clip, ttlSeconds);
      socket.join(code);
      if (typeof callback === 'function') {
        callback({ success: true, code, clip });
      }
    } catch (e) {
      if (typeof callback === 'function') {
        callback({ success: false, error: e.message });
      }
    }
  });

  socket.on('fetch_clip', async ({ code }, callback) => {
    const clip = await getClip(code ? code.trim() : '');
    if (!clip || (clip.expiresAt && clip.expiresAt <= Date.now())) {
      if (clip) await deleteClip(code);
      if (typeof callback === 'function') {
        return callback({ success: false, error: 'Clip not found or expired' });
      }
    } else {
      socket.join(code);
      if (typeof callback === 'function') {
        callback({ success: true, clip });
      }
    }
  });

  socket.on('delete_clip', async ({ code }) => {
    await deleteClip(code);
    io.to(code).emit('clip_deleted', { code });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 QuickClip Fast Sharing Server running on http://localhost:${PORT}`);
});
