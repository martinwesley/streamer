import express from 'express';
import next from 'next';
import { createClient } from '@libsql/client';
import cron from 'node-cron';
import { spawn } from 'child_process';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import https from 'https';
import http from 'http';
import { google } from 'googleapis';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

// Ensure db directory exists
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure uploads directory exists inside the persistent data volume
const uploadsDir = path.join(dbDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = createClient({ url: `file:${path.join(dbDir, 'local.db')}` });

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-change-in-prod');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/api/auth/youtube/callback`
);

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      youtube_tokens TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      filename TEXT,
      original_name TEXT,
      path TEXT,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      video_id INTEGER,
      rtmp_url TEXT,
      stream_key TEXT,
      broadcast_id TEXT,
      scheduled_for DATETIME,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      rtmp_url TEXT,
      stream_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const hash = await bcrypt.hash('prophet123', 10);
  try {
    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash) VALUES (1, ?, ?)',
      args: ['martin', hash]
    });
  } catch (e) {
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE username = ?',
      args: [hash, 'martin']
    });
  }
}

// Multer setup for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// JWT Middleware
async function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}

app.prepare().then(async () => {
  await initDb();

  const server = express();
  server.use(express.json());
  
  // Parse cookies manually for simplicity
  server.use((req, res, next) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        req.cookies[parts.shift().trim()] = decodeURI(parts.join('='));
      });
    }
    next();
  });

  // --- API Routes ---

  server.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (username !== 'martin') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username]
    });
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password_hash)) {
      const token = await new jose.SignJWT({ id: user.id, username: user.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(JWT_SECRET);
      
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  server.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  server.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });

  server.get('/api/auth/youtube/url', authenticateToken, (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
      prompt: 'consent'
    });
    res.json({ url });
  });

  server.get('/api/auth/youtube/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code);
      // We need to know which user this is.
      // Since this is a popup, we can't easily get the user from the session if cookies are blocked.
      // But in this app, we assume it's the current user.
      // However, the callback is a separate request.
      // Let's use a simple approach: store tokens in a temporary place or use a state parameter.
      // For now, let's assume the user is 'martin' (id 1) as per the hardcoded logic.
      await db.execute({
        sql: 'UPDATE users SET youtube_tokens = ? WHERE id = 1',
        args: [JSON.stringify(tokens)]
      });
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>YouTube connected successfully. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('YouTube OAuth error:', err);
      res.status(500).send('Authentication failed');
    }
  });

  server.get('/api/saved-keys', authenticateToken, async (req, res) => {
    const result = await db.execute({
      sql: 'SELECT * FROM saved_keys WHERE user_id = ? ORDER BY created_at DESC',
      args: [req.user.id]
    });
    res.json({ keys: result.rows });
  });

  server.post('/api/saved-keys', authenticateToken, async (req, res) => {
    const { name, rtmp_url, stream_key } = req.body;
    if (!name || !rtmp_url || !stream_key) return res.status(400).json({ error: 'Missing fields' });
    try {
      const result = await db.execute({
        sql: 'INSERT INTO saved_keys (user_id, name, rtmp_url, stream_key) VALUES (?, ?, ?, ?)',
        args: [req.user.id, name, rtmp_url, stream_key]
      });
      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save key' });
    }
  });

  server.delete('/api/saved-keys/:id', authenticateToken, async (req, res) => {
    try {
      await db.execute({
        sql: 'DELETE FROM saved_keys WHERE id = ? AND user_id = ?',
        args: [req.params.id, req.user.id]
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete key' });
    }
  });

  server.post('/api/videos/upload', authenticateToken, upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
      const result = await db.execute({
        sql: 'INSERT INTO videos (user_id, filename, original_name, path, size) VALUES (?, ?, ?, ?, ?)',
        args: [req.user.id, req.file.filename, req.file.originalname, req.file.path, req.file.size]
      });
      res.json({ success: true, videoId: Number(result.lastInsertRowid) });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  server.post('/api/videos/import', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    try {
      const filename = Date.now() + '-imported.mp4';
      const destPath = path.join(uploadsDir, filename);
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to download file' });
      }
      
      const fileStream = fs.createWriteStream(destPath);
      
      // Node.js 18+ fetch response body is a web ReadableStream
      // We can use stream.Readable.fromWeb to pipe it
      const { Readable } = await import('stream');
      const readableWebStream = response.body;
      
      if (readableWebStream) {
        const nodeStream = Readable.fromWeb(readableWebStream);
        nodeStream.pipe(fileStream);
        
        fileStream.on('finish', async () => {
          fileStream.close();
          const stats = fs.statSync(destPath);
          const result = await db.execute({
            sql: 'INSERT INTO videos (user_id, filename, original_name, path, size) VALUES (?, ?, ?, ?, ?)',
            args: [req.user.id, filename, 'imported_video', destPath, stats.size]
          });
          res.json({ success: true, videoId: Number(result.lastInsertRowid) });
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          res.status(500).json({ error: err.message });
        });
      } else {
        res.status(400).json({ error: 'Empty response body' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Import failed' });
    }
  });

  server.get('/api/videos', authenticateToken, async (req, res) => {
    const result = await db.execute({
      sql: 'SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC',
      args: [req.user.id]
    });
    res.json({ videos: result.rows });
  });

  server.post('/api/streams', authenticateToken, async (req, res) => {
    const { video_id, rtmp_url, stream_key, broadcast_id, scheduled_for } = req.body;
    if (!video_id || !rtmp_url || !stream_key || !scheduled_for) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    try {
      const result = await db.execute({
        sql: 'INSERT INTO streams (user_id, video_id, rtmp_url, stream_key, broadcast_id, scheduled_for) VALUES (?, ?, ?, ?, ?, ?)',
        args: [req.user.id, video_id, rtmp_url, stream_key, broadcast_id, scheduled_for]
      });
      res.json({ success: true, streamId: Number(result.lastInsertRowid) });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  server.get('/api/streams', authenticateToken, async (req, res) => {
    const result = await db.execute({
      sql: `
        SELECT s.*, v.original_name as video_name 
        FROM streams s 
        JOIN videos v ON s.video_id = v.id 
        WHERE s.user_id = ? 
        ORDER BY s.scheduled_for DESC
      `,
      args: [req.user.id]
    });
    res.json({ streams: result.rows });
  });

  server.delete('/api/videos/:id', authenticateToken, async (req, res) => {
    const videoId = req.params.id;
    try {
      const videoRes = await db.execute({
        sql: 'SELECT * FROM videos WHERE id = ? AND user_id = ?',
        args: [videoId, req.user.id]
      });
      const video = videoRes.rows[0];
      if (!video) return res.status(404).json({ error: 'Video not found' });

      if (fs.existsSync(video.path)) {
        fs.unlinkSync(video.path);
      }

      await db.execute({
        sql: 'DELETE FROM videos WHERE id = ?',
        args: [videoId]
      });
      
      await db.execute({
        sql: 'DELETE FROM streams WHERE video_id = ?',
        args: [videoId]
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete video' });
    }
  });

  server.delete('/api/streams/:id', authenticateToken, async (req, res) => {
    const streamId = req.params.id;
    try {
      await db.execute({
        sql: 'DELETE FROM streams WHERE id = ? AND user_id = ?',
        args: [streamId, req.user.id]
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete stream' });
    }
  });

  // Fallback to Next.js handler
  server.all(/.*/, (req, res) => {
    return handle(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

  // --- Cron Job for Streaming ---
  cron.schedule('* * * * *', async () => {
    console.log('Checking for scheduled streams...');
    const now = new Date();
    const kolkataTimeStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    const serverLocalTime = kolkataTimeStr.replace(' ', 'T').slice(0, 16);
    
    try {
      const result = await db.execute({
        sql: `
          SELECT s.*, v.path as video_path 
          FROM streams s 
          JOIN videos v ON s.video_id = v.id 
          WHERE s.status = 'pending' AND s.scheduled_for <= ?
        `,
        args: [serverLocalTime]
      });

      for (const row of result.rows) {
        startStream(row);
      }
    } catch (err) {
      console.error('Error checking streams:', err);
    }
  });

  function startStream(stream) {
    const { id, user_id, video_path, rtmp_url, stream_key, broadcast_id } = stream;
    // Ensure URL ends with / if needed, though usually it's just concatenated
    const separator = rtmp_url.endsWith('/') ? '' : '/';
    const fullRtmpUrl = `${rtmp_url}${separator}${stream_key}`;
    
    console.log(`Starting stream ${id} to ${rtmp_url}`);
    
    db.execute({
      sql: "UPDATE streams SET status = 'streaming' WHERE id = ?",
      args: [id]
    });

    const ffmpeg = spawn('ffmpeg', [
      '-re',
      '-i', video_path,
      '-vf', 'tpad=stop_mode=clone:stop_duration=5',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', '3000k',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p',
      '-g', '50',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ac', '2',
      '-ar', '44100',
      '-f', 'flv',
      fullRtmpUrl
    ]);

    ffmpeg.stdout.on('data', (data) => {
      // console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      // console.error(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', async (code) => {
      console.log(`ffmpeg process for stream ${id} exited with code ${code}`);
      db.execute({
        sql: "UPDATE streams SET status = ? WHERE id = ?",
        args: [code === 0 ? 'completed' : 'failed', id]
      });

      if (code === 0 && broadcast_id) {
        console.log(`Waiting 5 seconds to end YouTube broadcast ${broadcast_id}...`);
        setTimeout(async () => {
          try {
            const userResult = await db.execute({
              sql: 'SELECT youtube_tokens FROM users WHERE id = ?',
              args: [user_id]
            });
            const tokensStr = userResult.rows[0]?.youtube_tokens;
            if (tokensStr) {
              const tokens = JSON.parse(tokensStr);
              const auth = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                `${process.env.APP_URL}/api/auth/youtube/callback`
              );
              auth.setCredentials(tokens);
              
              const youtube = google.youtube({ version: 'v3', auth });
              await youtube.liveBroadcasts.transition({
                id: broadcast_id,
                broadcastStatus: 'complete',
                part: ['id', 'status']
              });
              console.log(`Successfully ended YouTube broadcast ${broadcast_id}`);
            }
          } catch (err) {
            console.error(`Failed to end YouTube broadcast ${broadcast_id}:`, err);
          }
        }, 5000);
      }
    });
  }
});
