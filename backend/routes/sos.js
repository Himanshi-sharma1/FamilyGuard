const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');
const locationRoutes = require('./location');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;
const verifyDevice = locationRoutes.verifyDevice;

// Trigger SOS (from app)
router.post('/', verifyDevice, (req, res) => {
  try {
    const { latitude, longitude, address, photo_url, voice_url } = req.body;
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Create SOS event
    const result = db.prepare('INSERT INTO sos_events (device_id, latitude, longitude, address, photo_url, voice_url) VALUES (?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      latitude || null,
      longitude || null,
      address || '',
      photo_url || null,
      voice_url || null
    );
    
    // Also create an alert
    db.prepare('INSERT INTO alerts (device_id, type, title, message, latitude, longitude, address, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      'sos',
      'SOS EMERGENCY',
      'Father has triggered an emergency SOS alert!',
      latitude || null,
      longitude || null,
      address || '',
      photo_url || null
    );
    
    const sosEvent = {
      id: result.lastInsertRowid,
      device_id: req.device.device_id,
      latitude,
      longitude,
      address,
      photo_url,
      voice_url,
      created_at: new Date().toISOString()
    };
    
    // Emit SOS to all dashboard users
    io.to('dashboard').emit('sos:triggered', sosEvent);
    
    // Also emit as a critical alert
    io.to('dashboard').emit('alert:new', {
      type: 'sos',
      title: 'SOS EMERGENCY',
      message: 'Father has triggered an emergency SOS alert!',
      latitude,
      longitude,
      address,
      photo_url,
      created_at: new Date().toISOString()
    });
    
    res.json(sosEvent);
  } catch (err) {
    console.error('SOS error:', err);
    res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

// Get SOS events (dashboard)
router.get('/', verifyToken, (req, res) => {
  try {
    const { resolved, limit = 20, offset = 0 } = req.query;
    const db = getDB();
    
    let query = 'SELECT * FROM sos_events WHERE 1=1';
    const params = [];
    
    if (resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const events = db.prepare(query).all(...params);
    
    res.json(events);
  } catch (err) {
    console.error('Get SOS events error:', err);
    res.status(500).json({ error: 'Failed to get SOS events' });
  }
});

// Get latest unresolved SOS
router.get('/active', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const sos = db.prepare('SELECT * FROM sos_events WHERE resolved = 0 ORDER BY created_at DESC LIMIT 1').get();
    
    if (!sos) {
      return res.json({ message: 'No active SOS events' });
    }
    
    res.json(sos);
  } catch (err) {
    console.error('Get active SOS error:', err);
    res.status(500).json({ error: 'Failed to get SOS' });
  }
});

// Resolve SOS (dashboard)
router.put('/:id/resolve', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    db.prepare('UPDATE sos_events SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?').run(
      req.user.username,
      new Date().toISOString(),
      id
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Resolve SOS error:', err);
    res.status(500).json({ error: 'Failed to resolve SOS' });
  }
});

module.exports = router;
