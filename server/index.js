const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { upload } = require('./upload');
const {
  authenticateToken,
  register,
  login,
  getMe,
  getUsers,
  getPendingUsers,
  approveUser,
  getDomains,
  addDomain,
} = require('./auth');
const setupSocketHandlers = require('./socket');
const { dbAll } = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB
});

// Security Middleware & Anti-Hacking Headers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Anti-hacking security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple Memory Rate Limiter to prevent brute-force login attacks
const loginAttempts = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recentAttempts = attempts.filter((timestamp) => now - timestamp < 15 * 60 * 1000); // 15 mins window

  if (recentAttempts.length >= 20) {
    return res.status(429).json({ error: 'Too many requests. Please wait 15 minutes for anti-hacking security.' });
  }

  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  next();
};

// Serve Uploaded Files Statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Client App if built
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// REST API Routes
app.post('/api/auth/register', rateLimiter, register);
app.post('/api/auth/login', rateLimiter, login);
app.get('/api/auth/me', authenticateToken, getMe);

// User Directory
app.get('/api/users', authenticateToken, getUsers);

// File & Media Upload Endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error('File Upload Error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Admin Routes
app.get('/api/admin/pending-users', authenticateToken, getPendingUsers);
app.post('/api/admin/approve-user', authenticateToken, approveUser);
app.get('/api/admin/domains', authenticateToken, getDomains);
app.post('/api/admin/add-domain', authenticateToken, addDomain);

// Call History Route
app.get('/api/calls/history', authenticateToken, async (req, res) => {
  try {
    const logs = await dbAll(
      `SELECT cl.*, 
              u1.username as caller_name, u1.avatar as caller_avatar,
              u2.username as receiver_name, u2.avatar as receiver_avatar
       FROM call_logs cl
       JOIN users u1 ON cl.caller_id = u1.id
       JOIN users u2 ON cl.receiver_id = u2.id
       WHERE cl.caller_id = ? OR cl.receiver_id = ?
       ORDER BY cl.created_at DESC LIMIT 50`,
      [req.user.id, req.user.id]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Private Chat Server is Running. Build client app for full UI.');
    }
  });
});

// Socket.IO Handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 7860;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Private Chat Server running on http://localhost:${PORT}`);
  console.log(`===================================================`);
});
