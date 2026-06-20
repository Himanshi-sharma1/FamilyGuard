const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');
const locationRoutes = require('./location');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;
const verifyDevice = locationRoutes.verifyDevice;

// I Am Safe check-in (from app)
router.post('/', verifyDevice, (req, res) => {
  try {
    const { latitude, longitude, address, photo_url } = req.body;
    
    const db = getDB();
    const io = req.app.get('io');
    
    const result = db.prepare('INSERT INTO checkins (device_id, latitude, longitude, address, photo_url) VALUES (?, ?, ?, ?, ?)').run(
      req.device.device_id,
      latitude || null,
      longitude || null,
      address || '',
      photo_url || null
    );
    
    const checkin = {
      id: result.lastInsertRowid,
      device_id: req.device.device_id,
      latitude,
      longitude,
      address,
      photo_url,
      timestamp: new Date().toISOString()
    };
    
    // Emit to dashboard
    io.to('dashboard').emit('checkin:new', checkin);
    
    res.json(checkin);
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Get latest check-in (dashboard)
router.get('/latest', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const checkin = db.prepare('SELECT * FROM checkins ORDER BY timestamp DESC LIMIT 1').get();
    
    if (!checkin) {
      return res.json({ message: 'No check-ins yet' });
    }
    
    res.json(checkin);
  } catch (err) {
    console.error('Get latest check-in error:', err);
    res.status(500).json({ error: 'Failed to get check-in' });
  }
});

// Get check-in history (dashboard)
router.get('/history', verifyToken, (req, res) => {
  try {
    const { from, to, limit = 50, offset = 0 } = req.query;
    const db = getDB();
    
    let query = 'SELECT * FROM checkins WHERE 1=1';
    const params = [];
    
    if (from) {
      query += ' AND date(timestamp) >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND date(timestamp) <= ?';
      params.push(to);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const checkins = db.prepare(query).all(...params);
    
    res.json(checkins);
  } catch (err) {
    console.error('Get check-in history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get today's check-ins
router.get('/today', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const checkins = db.prepare("SELECT * FROM checkins WHERE date(timestamp) = ? ORDER BY timestamp DESC").all(today);
    
    res.json(checkins);
  } catch (err) {
    console.error('Get today check-ins error:', err);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
});

module.exports = router;
