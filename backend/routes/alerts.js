const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;

// Create alert (from app or server)
router.post('/', (req, res) => {
  try {
    const { device_id, type, title, message, latitude, longitude, address, photo_url } = req.body;
    
    if (!type || !title) {
      return res.status(400).json({ error: 'Type and title required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    const result = db.prepare('INSERT INTO alerts (device_id, type, title, message, latitude, longitude, address, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      device_id || 'demo_device',
      type,
      title,
      message || '',
      latitude || null,
      longitude || null,
      address || '',
      photo_url || null
    );
    
    const alert = {
      id: result.lastInsertRowid,
      device_id: device_id || 'demo_device',
      type,
      title,
      message,
      latitude,
      longitude,
      address,
      photo_url,
      is_read: 0,
      created_at: new Date().toISOString()
    };
    
    // Emit to dashboard
    io.to('dashboard').emit('alert:new', alert);
    
    res.json(alert);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Get alerts with filters
router.get('/', verifyToken, (req, res) => {
  try {
    const { type, from, to, unread_only, limit = 50, offset = 0 } = req.query;
    
    const db = getDB();
    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (from) {
      query += ' AND date(created_at) >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND date(created_at) <= ?';
      params.push(to);
    }
    
    if (unread_only === 'true') {
      query += ' AND is_read = 0';
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const alerts = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM alerts WHERE 1=1';
    const countParams = [];
    
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (from) {
      countQuery += ' AND date(created_at) >= ?';
      countParams.push(from);
    }
    if (to) {
      countQuery += ' AND date(created_at) <= ?';
      countParams.push(to);
    }
    if (unread_only === 'true') {
      countQuery += ' AND is_read = 0';
    }
    
    const count = db.prepare(countQuery).get(...countParams);
    
    res.json({
      alerts,
      total: count.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get unread count
router.get('/unread-count', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0').get();
    res.json({ count: result.count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Mark alert as read
router.put('/:id/read', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    db.prepare('UPDATE alerts SET is_read = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?').run(
      req.user.username,
      new Date().toISOString(),
      id
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all as read
router.put('/read-all', verifyToken, (req, res) => {
  try {
    const db = getDB();
    
    db.prepare('UPDATE alerts SET is_read = 1, acknowledged_by = ?, acknowledged_at = ? WHERE is_read = 0').run(
      req.user.username,
      new Date().toISOString()
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Get critical alerts (SOS, Fall - unacknowledged)
router.get('/critical', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const alerts = db.prepare("SELECT * FROM alerts WHERE type IN ('sos', 'fall') AND is_read = 0 ORDER BY created_at DESC").all();
    res.json(alerts);
  } catch (err) {
    console.error('Get critical alerts error:', err);
    res.status(500).json({ error: 'Failed to get critical alerts' });
  }
});

module.exports = router;
