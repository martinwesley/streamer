import express from 'express';
import next from 'next';
import { createClient } from '@libsql/client';
import cron from 'node-cron';
import { spawn, spawnSync } from 'child_process';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import https from 'https';
import http from 'http';
import { google } from 'googleapis';
import ffmpegPath from 'ffmpeg-static';
import si from 'systeminformation';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 7575;

// Ensure db directory exists
const isDockerOrCloud = fs.existsSync('/app');
const dbDir = process.env.DATA_DIR || (isDockerOrCloud ? '/app/data' : path.join(process.cwd(), 'data'));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure uploads directory exists inside the persistent data volume
const uploadsDir = process.env.UPLOADS_DIR || (isDockerOrCloud ? '/app/uploads' : path.join(process.cwd(), 'uploads'));
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

  // Reset any streams that were interrupted by a server restart
  await db.execute(`
    UPDATE streams SET status = 'failed' WHERE status = 'streaming'
  `);
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

  server.get('/api/youtube/broadcasts', authenticateToken, async (req, res) => {
    try {
      const userResult = await db.execute({
        sql: 'SELECT youtube_tokens FROM users WHERE id = ?',
        args: [req.user.id]
      });
      const tokensStr = userResult.rows[0]?.youtube_tokens;
      if (!tokensStr) {
        return res.status(400).json({ error: 'YouTube not connected' });
      }

      const tokens = JSON.parse(tokensStr);
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.APP_URL}/api/auth/youtube/callback`
      );
      auth.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'all',
        broadcastType: 'all',
        maxResults: 50
      });

      const broadcasts = response.data.items?.map(item => ({
        id: item.id,
        title: item.snippet?.title,
        status: item.status?.lifeCycleStatus,
        scheduledStartTime: item.snippet?.scheduledStartTime
      })) || [];

      res.json({ broadcasts });
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
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

  // Global map for import progress
  const importProgressMap = new Map();

  server.post('/api/videos/import', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    const importId = Date.now().toString() + Math.random().toString(36).substring(7);
    importProgressMap.set(importId, { progress: 0, status: 'downloading' });
    
    // Send back the importId immediately so client can poll
    res.json({ success: true, importId });

    try {
      const filename = Date.now() + '-imported.mp4';
      const destPath = path.join(uploadsDir, filename);
      
      const response = await fetch(url);
      if (!response.ok) {
        importProgressMap.set(importId, { progress: 0, status: 'failed', error: 'Failed to download file' });
        return;
      }
      
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);
      
      const { Readable } = await import('stream');
      const readableWebStream = response.body;
      
      if (readableWebStream) {
        const nodeStream = Readable.fromWeb(readableWebStream);
        
        nodeStream.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            importProgressMap.set(importId, { progress: percent, status: 'downloading' });
          } else {
            // Fake progress if no content length
            const currentProgress = importProgressMap.get(importId)?.progress || 0;
            importProgressMap.set(importId, { progress: Math.min(currentProgress + 1, 99), status: 'downloading' });
          }
        });

        nodeStream.pipe(fileStream);
        
        fileStream.on('finish', async () => {
          fileStream.close();
          const stats = fs.statSync(destPath);
          const result = await db.execute({
            sql: 'INSERT INTO videos (user_id, filename, original_name, path, size) VALUES (?, ?, ?, ?, ?)',
            args: [req.user.id, filename, 'imported_video', destPath, stats.size]
          });
          importProgressMap.set(importId, { progress: 100, status: 'completed', videoId: Number(result.lastInsertRowid) });
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          importProgressMap.set(importId, { progress: 0, status: 'failed', error: err.message });
        });
      } else {
        importProgressMap.set(importId, { progress: 0, status: 'failed', error: 'Empty response body' });
      }
    } catch (err) {
      importProgressMap.set(importId, { progress: 0, status: 'failed', error: 'Import failed' });
    }
  });

  server.get('/api/videos/import-progress/:id', authenticateToken, (req, res) => {
    const data = importProgressMap.get(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  });

  server.get('/api/system-stats', authenticateToken, async (req, res) => {
    try {
      const [cpu, mem, fsSize, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ]);
      console.log('networkStats:', JSON.stringify(networkStats, null, 2));

      let rx_sec = 0;
      let tx_sec = 0;
      networkStats.forEach(net => {
        rx_sec += net.rx_sec;
        tx_sec += net.tx_sec;
      });

      const mainFs = fsSize.find(fs => fs.mount === '/') || fsSize[0];

      res.json({
        cpu: cpu.currentLoad,
        memory: {
          used: mem.active,
          total: mem.total
        },
        disk: {
          used: mainFs ? mainFs.used : 0,
          total: mainFs ? mainFs.size : 0
        },
        network: {
          rx_sec,
          tx_sec,
          interfaces: networkStats.map(net => ({
            iface: net.iface,
            operstate: net.operstate,
            rx_sec: net.rx_sec,
            tx_sec: net.tx_sec,
            speed: net.speed
          }))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system stats' });
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

    const probeRes = spawnSync(ffmpegPath, ['-i', video_path]);
    const hasAudio = probeRes.stderr.toString().includes('Audio:');
    
    const args = [
      '-v', 'debug',
      '-use_ipv4', '1',
      '-protocol_whitelist', 'file,rtmp,tcp,udp,crypto,tls',
      '-re',
      '-i', video_path
    ];

    if (!hasAudio) {
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }

    args.push(
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
      '-ar', '44100'
    );

    if (!hasAudio) {
      args.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
    }

    args.push('-f', 'flv', fullRtmpUrl);

    const ffmpeg = spawn(ffmpegPath, args, { env: process.env });

    ffmpeg.stdout.on('data', (data) => {
      // console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on('error', (err) => {
      console.error(`Failed to start ffmpeg process for stream ${id}:`, err);
      db.execute({
        sql: "UPDATE streams SET status = 'failed' WHERE id = ?",
        args: [id]
      });
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
