require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/location');
const alertsRoutes = require('./routes/alerts');
const healthRoutes = require('./routes/health');
const mediaRoutes = require('./routes/media');
const checkinRoutes = require('./routes/checkin');
const sosRoutes = require('./routes/sos');
const statusRoutes = require('./routes/status');
const settingsRoutes = require('./routes/settings');
const streamingRoutes = require('./routes/streaming');

// Import services
const { initDB, getDB } = require('./services/database');
const { initScheduler } = require('./services/scheduler');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with enhanced configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 10 * 1024 * 1024 // 10MB for audio chunks
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Increased for streaming
  message: { error: 'Too many requests, please try again later' }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);

// Make io available to routes
app.set('io', io);

// Serve static files for dashboard
app.use(express.static(path.join(__dirname, '../dashboard')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Mobile PWA App
app.use('/app', express.static(path.join(__dirname, '../dashboard/app')));
app.use('/apk', express.static(path.join(__dirname, '../apk')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/location', locationRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/checkin', checkinRoutes);
app.use('/api/v1/sos', sosRoutes);
app.use('/api/v1/status', statusRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/streaming', streamingRoutes);

// Store active streams
const activeStreams = {
  audio: new Map(),
  video: new Map()
};

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join:dashboard', () => {
    socket.join('dashboard');
    console.log('Dashboard client joined:', socket.id);
  });
  
  socket.on('join:app', (deviceId) => {
    socket.join('app');
    socket.deviceId = deviceId;
    console.log('App client joined:', socket.id, deviceId);
  });
  
  // WebRTC signaling for video calls
  socket.on('call:offer', (data) => {
    io.to('app').emit('call:offer', { ...data, from: socket.id });
  });
  
  socket.on('call:answer', (data) => {
    io.to('dashboard').emit('call:answer', { ...data, from: socket.id });
  });
  
  socket.on('call:ice-candidate', (data) => {
    socket.broadcast.emit('call:ice-candidate', data);
  });
  
  socket.on('call:hangup', () => {
    socket.broadcast.emit('call:hangup');
  });
  
  // Live audio streaming events
  socket.on('audio:stream:start', (data) => {
    activeStreams.audio.set(socket.id, {
      deviceId: data.deviceId || socket.deviceId,
      startTime: new Date()
    });
    io.to('dashboard').emit('audio:stream:started', {
      deviceId: data.deviceId || socket.deviceId,
      socketId: socket.id
    });
    console.log('Audio stream started:', socket.id);
  });
  
  socket.on('audio:stream:data', (data) => {
    // Forward audio chunk to dashboard
    io.to('dashboard').emit('audio:stream:chunk', {
      data: data.chunk,
      timestamp: new Date().toISOString(),
      deviceId: socket.deviceId
    });
  });
  
  socket.on('audio:stream:stop', () => {
    activeStreams.audio.delete(socket.id);
    io.to('dashboard').emit('audio:stream:stopped', {
      socketId: socket.id
    });
    console.log('Audio stream stopped:', socket.id);
  });
  
  // Live camera streaming events
  socket.on('camera:stream:start', (data) => {
    activeStreams.video.set(socket.id, {
      deviceId: data.deviceId || socket.deviceId,
      startTime: new Date()
    });
    io.to('dashboard').emit('camera:stream:started', {
      deviceId: data.deviceId || socket.deviceId,
      socketId: socket.id
    });
    console.log('Camera stream started:', socket.id);
  });
  
  socket.on('camera:stream:frame', (data) => {
    // Forward video frame to dashboard
    io.to('dashboard').emit('camera:stream:frame', {
      frame: data.frame,
      timestamp: new Date().toISOString(),
      deviceId: socket.deviceId
    });
  });
  
  socket.on('camera:stream:stop', () => {
    activeStreams.video.delete(socket.id);
    io.to('dashboard').emit('camera:stream:stopped', {
      socketId: socket.id
    });
    console.log('Camera stream stopped:', socket.id);
  });
  
  // Request from dashboard to start/stop remote features
  socket.on('dashboard:request:audio:start', () => {
    io.to('app').emit('remote:audio:start');
    console.log('Dashboard requested audio start');
  });
  
  socket.on('dashboard:request:audio:stop', () => {
    io.to('app').emit('remote:audio:stop');
    console.log('Dashboard requested audio stop');
  });
  
  socket.on('dashboard:request:camera:start', () => {
    io.to('app').emit('remote:camera:start');
    console.log('Dashboard requested camera start');
  });
  
  socket.on('dashboard:request:camera:stop', () => {
    io.to('app').emit('remote:camera:stop');
    console.log('Dashboard requested camera stop');
  });
  
  socket.on('disconnect', () => {
    // Clean up any active streams
    if (activeStreams.audio.has(socket.id)) {
      activeStreams.audio.delete(socket.id);
      io.to('dashboard').emit('audio:stream:stopped', { socketId: socket.id });
    }
    if (activeStreams.video.has(socket.id)) {
      activeStreams.video.delete(socket.id);
      io.to('dashboard').emit('camera:stream:stopped', { socketId: socket.id });
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Serve dashboard for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dashboard/index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8888;

// Initialize database and start server
initDB().then(() => {
  // Create audio recordings table
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_url TEXT,
      duration INTEGER,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      segment_type TEXT DEFAULT 'continuous',
      is_live INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audio_device_time ON audio_recordings(device_id, start_time);
  `);
  
  initScheduler(io);
  server.listen(PORT, '0.0.0.0', () => {
    console.log('FamilyGuard server running on port ' + PORT);
    console.log('Dashboard: http://0.0.0.0:' + PORT);
    console.log('API: http://0.0.0.0:' + PORT + '/api/v1');
    console.log('Streaming enabled for audio and camera');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = { app, io };
