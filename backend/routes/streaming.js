const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');
const locationRoutes = require('./location');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;
const verifyDevice = locationRoutes.verifyDevice;

// Configure multer for audio uploads
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'recordings');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `rec_${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  }
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, true); // Accept all audio for flexibility
    }
  }
});

// Upload audio recording chunk (from app - 24x7 recording)
router.post('/audio', verifyDevice, uploadAudio.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }
    
    const { start_time, end_time, duration, segment_type } = req.body;
    const db = getDB();
    const io = req.app.get('io');
    
    const fileUrl = '/uploads/recordings/' + req.file.filename;
    
    // Ensure audio_recordings table exists
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
    `);
    
    const result = db.prepare('INSERT INTO audio_recordings (device_id, file_path, file_url, duration, start_time, end_time, segment_type) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      req.file.path,
      fileUrl,
      duration ? parseInt(duration) : null,
      start_time || new Date().toISOString(),
      end_time || null,
      segment_type || 'continuous'
    );
    
    const recording = {
      id: result.lastInsertRowid,
      file_url: fileUrl,
      duration: duration ? parseInt(duration) : null,
      start_time: start_time || new Date().toISOString(),
      segment_type: segment_type || 'continuous',
      created_at: new Date().toISOString()
    };
    
    // Notify dashboard of new recording
    io.to('dashboard').emit('audio:new', recording);
    
    // Clean up old recordings (keep last 7 days)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oldRecordings = db.prepare('SELECT file_path FROM audio_recordings WHERE created_at < ?').all(cutoff);
    oldRecordings.forEach(rec => {
      if (fs.existsSync(rec.file_path)) {
        try { fs.unlinkSync(rec.file_path); } catch(e) {}
      }
    });
    db.prepare('DELETE FROM audio_recordings WHERE created_at < ?').run(cutoff);
    
    res.json(recording);
  } catch (err) {
    console.error('Upload audio error:', err);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

// Get audio recordings (dashboard)
router.get('/audio', verifyToken, (req, res) => {
  try {
    const { date, from, to, limit = 100, offset = 0 } = req.query;
    const db = getDB();
    
    let query = 'SELECT * FROM audio_recordings WHERE 1=1';
    const params = [];
    
    if (date) {
      query += ' AND date(start_time) = ?';
      params.push(date);
    }
    
    if (from) {
      query += ' AND start_time >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND start_time <= ?';
      params.push(to);
    }
    
    query += ' ORDER BY start_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const recordings = db.prepare(query).all(...params);
    
    // Get total count for the query
    let countQuery = 'SELECT COUNT(*) as total FROM audio_recordings WHERE 1=1';
    const countParams = [];
    if (date) {
      countQuery += ' AND date(start_time) = ?';
      countParams.push(date);
    }
    if (from) {
      countQuery += ' AND start_time >= ?';
      countParams.push(from);
    }
    if (to) {
      countQuery += ' AND start_time <= ?';
      countParams.push(to);
    }
    const count = db.prepare(countQuery).get(...countParams);
    
    res.json({
      recordings,
      total: count ? count.total : 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Get audio recordings error:', err);
    res.status(500).json({ error: 'Failed to get recordings', recordings: [] });
  }
});

// Get audio timeline for a specific date (dashboard)
router.get('/audio/timeline', verifyToken, (req, res) => {
  try {
    const { date } = req.query;
    const db = getDB();
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const recordings = db.prepare(`
      SELECT id, start_time, end_time, duration, file_url 
      FROM audio_recordings 
      WHERE date(start_time) = ?
      ORDER BY start_time ASC
    `).all(targetDate);
    
    // Create timeline with hour segments
    const timeline = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      const hourRecordings = recordings.filter(r => {
        const recHour = new Date(r.start_time).getHours();
        return recHour === hour;
      });
      
      timeline.push({
        hour: hourStr + ':00',
        has_recording: hourRecordings.length > 0,
        recordings: hourRecordings
      });
    }
    
    res.json({
      date: targetDate,
      timeline,
      total_recordings: recordings.length
    });
  } catch (err) {
    console.error('Get audio timeline error:', err);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Delete audio recording
router.delete('/audio/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    const recording = db.prepare('SELECT file_path FROM audio_recordings WHERE id = ?').get(id);
    if (recording && fs.existsSync(recording.file_path)) {
      fs.unlinkSync(recording.file_path);
    }
    
    db.prepare('DELETE FROM audio_recordings WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete audio error:', err);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Live audio stream status
router.post('/audio/live/start', verifyDevice, (req, res) => {
  try {
    const io = req.app.get('io');
    io.to('dashboard').emit('audio:live:started', {
      device_id: req.device.device_id,
      started_at: new Date().toISOString()
    });
    res.json({ success: true, message: 'Live audio stream started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start live audio' });
  }
});

router.post('/audio/live/stop', verifyDevice, (req, res) => {
  try {
    const io = req.app.get('io');
    io.to('dashboard').emit('audio:live:stopped', {
      device_id: req.device.device_id,
      stopped_at: new Date().toISOString()
    });
    res.json({ success: true, message: 'Live audio stream stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop live audio' });
  }
});

// Camera snapshot (for live camera view)
router.post('/camera/snapshot', verifyDevice, uploadAudio.single('snapshot'), (req, res) => {
  try {
    const io = req.app.get('io');
    
    // For camera, we'll use a different storage
    const snapshotDir = path.join(__dirname, '..', 'uploads', 'camera');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    if (req.file) {
      const fileUrl = '/uploads/camera/' + req.file.filename;
      io.to('dashboard').emit('camera:snapshot', {
        file_url: fileUrl,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, file_url: fileUrl });
    } else {
      res.status(400).json({ error: 'Snapshot file required' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload snapshot' });
  }
});

module.exports = router;
