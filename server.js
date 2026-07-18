require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const curriculum = require('./curriculum');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.ensureDirSync(UPLOADS_DIR);

function sanitize(name) {
  if (!name) return 'unknown';
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'unknown';
}

function getChapterDir(classKey, streamKey, subjectKey, chapterName) {
  const chapterSlug = sanitize(chapterName).replace(/\s+/g, '-').toLowerCase();
  return path.join(UPLOADS_DIR, classKey, streamKey, subjectKey, chapterSlug);
}

function getCategoryDir(classKey, streamKey, subjectKey, chapterName, category) {
  return path.join(getChapterDir(classKey, streamKey, subjectKey, chapterName), category);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.get('/api/curriculum', (req, res) => {
  res.json(curriculum);
});

app.get('/api/ncert/:class/:stream/:subject', async (req, res) => {
  try {
    const { class: cls, stream, subject } = req.params;
    const ncertDir = path.join(UPLOADS_DIR, cls, stream, subject, 'ncert-textbook');
    if (await fs.pathExists(ncertDir)) {
      const files = (await fs.readdir(ncertDir)).filter(f => f.endsWith('.pdf'));
      res.json(files.map(f => ({
        name: f,
        size: fs.statSync(path.join(ncertDir, f)).size,
        url: `/uploads/${cls}/${stream}/${subject}/ncert-textbook/${encodeURIComponent(f)}`
      })));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/files/:class/:stream/:subject/:chapter', async (req, res) => {
  try {
    const { class: cls, stream, subject, chapter } = req.params;
    const chapterDir = getChapterDir(cls, stream, subject, chapter);
    const categories = ['notes', 'books', 'pdfs'];
    const result = {};

    for (const cat of categories) {
      const catDir = path.join(chapterDir, cat);
      if (await fs.pathExists(catDir)) {
        const files = await fs.readdir(catDir);
        result[cat] = files.map(f => ({
          name: f,
          size: fs.statSync(path.join(catDir, f)).size,
          url: `/uploads/${cls}/${stream}/${subject}/${sanitize(chapter).replace(/\s+/g, '-').toLowerCase()}/${cat}/${encodeURIComponent(f)}`
        }));
      } else {
        result[cat] = [];
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { class: cls, stream, subject, chapter, category } = req.body;
    if (!cls || !stream || !subject || !chapter || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const catDir = getCategoryDir(cls, stream, subject, chapter, category);
    await fs.ensureDir(catDir);
    const filename = Date.now() + '-' + req.file.originalname;
    await fs.writeFile(path.join(catDir, filename), req.file.buffer);
    res.json({ message: 'File uploaded successfully', file: filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:class/:stream/:subject/:chapter/:category/:filename', async (req, res) => {
  try {
    const { class: cls, stream, subject, chapter, category, filename } = req.params;
    const filePath = path.join(getCategoryDir(cls, stream, subject, chapter, category), filename);
    await fs.remove(filePath);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const messages = (history || []).map(m => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful CBSE school tutor for classes 11 and 12. You help students with doubts in Physics, Chemistry, Biology, Mathematics, English, and other subjects. Give clear, concise explanations suitable for high school students. Answer in the same language the student asks in.'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false
      })
    });

    if (!response.ok) {
      console.error('NVIDIA API error:', response.status);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Could not generate a response.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat service error' });
  }
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const { ensureNcertPdfs } = require('./ncert-loader');

app.listen(PORT, '0.0.0.0', async () => {
  if (!IS_PRODUCTION) {
    const os = require('os');
    const nets = os.networkInterfaces();
    let ip = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; }
      }
    }
    console.log(`\n  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${ip}:${PORT}\n`);
  }
  await ensureNcertPdfs();
});
