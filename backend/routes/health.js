const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');
const locationRoutes = require('./location');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;
const verifyDevice = locationRoutes.verifyDevice;

// Log mood (from app)
router.post('/mood', verifyDevice, (req, res) => {
  try {
    const { value, notes } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'Mood value required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    const result = db.prepare('INSERT INTO health_logs (device_id, type, value, notes) VALUES (?, ?, ?, ?)').run(
      req.device.device_id, 'mood', value, notes || ''
    );
    
    io.to('dashboard').emit('health:update', {
      type: 'mood',
      value,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Log mood error:', err);
    res.status(500).json({ error: 'Failed to log mood' });
  }
});

// Log water intake (from app)
router.post('/water', verifyDevice, (req, res) => {
  try {
    const { glasses = 1 } = req.body;
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Get today's total
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = db.prepare("SELECT SUM(CAST(value AS INTEGER)) as total FROM health_logs WHERE device_id = ? AND type = 'water' AND date(timestamp) = ?").get(req.device.device_id, today);
    
    const newTotal = (todayTotal?.total || 0) + glasses;
    
    const result = db.prepare('INSERT INTO health_logs (device_id, type, value) VALUES (?, ?, ?)').run(
      req.device.device_id, 'water', String(glasses)
    );
    
    io.to('dashboard').emit('health:update', {
      type: 'water',
      value: newTotal,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid, total: newTotal });
  } catch (err) {
    console.error('Log water error:', err);
    res.status(500).json({ error: 'Failed to log water' });
  }
});

// Log medication taken (from app)
router.post('/medication', verifyDevice, (req, res) => {
  try {
    const { medication_id, taken = true } = req.body;
    
    if (!medication_id) {
      return res.status(400).json({ error: 'Medication ID required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    const result = db.prepare('INSERT INTO medication_logs (medication_id, device_id, taken) VALUES (?, ?, ?)').run(
      medication_id, req.device.device_id, taken ? 1 : 0
    );
    
    io.to('dashboard').emit('health:update', {
      type: 'medication',
      medication_id,
      taken,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Log medication error:', err);
    res.status(500).json({ error: 'Failed to log medication' });
  }
});

// Sync step count (from app)
router.post('/steps', verifyDevice, (req, res) => {
  try {
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Step count required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Update today's step count (replace if exists)
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare("SELECT id FROM health_logs WHERE device_id = ? AND type = 'steps' AND date(timestamp) = ?").get(req.device.device_id, today);
    
    if (existing) {
      db.prepare('UPDATE health_logs SET value = ?, timestamp = ? WHERE id = ?').run(
        String(value), new Date().toISOString(), existing.id
      );
    } else {
      db.prepare('INSERT INTO health_logs (device_id, type, value) VALUES (?, ?, ?)').run(
        req.device.device_id, 'steps', String(value)
      );
    }
    
    io.to('dashboard').emit('health:update', {
      type: 'steps',
      value,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, steps: value });
  } catch (err) {
    console.error('Log steps error:', err);
    res.status(500).json({ error: 'Failed to log steps' });
  }
});

// Log sleep estimate (from app)
router.post('/sleep', verifyDevice, (req, res) => {
  try {
    const { value, notes } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Sleep hours required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    const result = db.prepare('INSERT INTO health_logs (device_id, type, value, notes) VALUES (?, ?, ?, ?)').run(
      req.device.device_id, 'sleep', String(value), notes || ''
    );
    
    io.to('dashboard').emit('health:update', {
      type: 'sleep',
      value,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Log sleep error:', err);
    res.status(500).json({ error: 'Failed to log sleep' });
  }
});

// Get health summary (dashboard)
router.get('/summary', verifyToken, (req, res) => {
  try {
    const { from, to, device_id = 'demo_device' } = req.query;
    const db = getDB();
    
    let dateFilter = '';
    let params = [device_id];
    
    if (from && to) {
      dateFilter = 'AND date(timestamp) BETWEEN ? AND ?';
      params = [device_id, from, to];
    } else {
      // Default to last 7 days - use date calculation in JS
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilter = 'AND timestamp >= ?';
      params = [device_id, sevenDaysAgo];
    }
    
    // Get mood data
    const moods = db.prepare(`SELECT value, timestamp FROM health_logs WHERE device_id = ? AND type = 'mood' ${dateFilter} ORDER BY timestamp ASC`).all(...params);
    
    // Get steps data
    const steps = db.prepare(`SELECT value, timestamp FROM health_logs WHERE device_id = ? AND type = 'steps' ${dateFilter} ORDER BY timestamp ASC`).all(...params);
    
    // Get water data
    const water = db.prepare(`SELECT value, timestamp FROM health_logs WHERE device_id = ? AND type = 'water' ${dateFilter} ORDER BY timestamp ASC`).all(...params);
    
    // Get sleep data
    const sleep = db.prepare(`SELECT value, timestamp FROM health_logs WHERE device_id = ? AND type = 'sleep' ${dateFilter} ORDER BY timestamp ASC`).all(...params);
    
    // Get today's summary
    const today = new Date().toISOString().split('T')[0];
    const todayMood = db.prepare("SELECT value FROM health_logs WHERE device_id = ? AND type = 'mood' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(device_id, today);
    const todaySteps = db.prepare("SELECT value FROM health_logs WHERE device_id = ? AND type = 'steps' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(device_id, today);
    const todayWater = db.prepare("SELECT SUM(CAST(value AS INTEGER)) as total FROM health_logs WHERE device_id = ? AND type = 'water' AND date(timestamp) = ?").get(device_id, today);
    
    // Get medication compliance
    const medications = db.prepare('SELECT * FROM medications WHERE device_id = ? AND active = 1').all(device_id);
    
    // Get medication logs for the period
    let medLogParams = [device_id];
    let medDateFilter = '';
    if (from && to) {
      medDateFilter = 'AND date(ml.timestamp) BETWEEN ? AND ?';
      medLogParams = [device_id, from, to];
    } else {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      medDateFilter = 'AND ml.timestamp >= ?';
      medLogParams = [device_id, sevenDaysAgo];
    }
    const medicationLogs = db.prepare(`SELECT ml.*, m.name FROM medication_logs ml JOIN medications m ON ml.medication_id = m.id WHERE ml.device_id = ? ${medDateFilter} ORDER BY ml.timestamp DESC`).all(...medLogParams);
    
    res.json({
      moods,
      steps,
      water,
      sleep,
      today: {
        mood: todayMood?.value || null,
        steps: todaySteps?.value ? parseInt(todaySteps.value) : 0,
        water: todayWater?.total || 0
      },
      medications,
      medication_logs: medicationLogs
    });
  } catch (err) {
    console.error('Get health summary error:', err);
    res.status(500).json({ error: 'Failed to get health summary' });
  }
});

// Get today's health snapshot
router.get('/today', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const device_id = req.query.device_id || 'demo_device';
    const today = new Date().toISOString().split('T')[0];
    
    const mood = db.prepare("SELECT value, timestamp FROM health_logs WHERE device_id = ? AND type = 'mood' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(device_id, today);
    const steps = db.prepare("SELECT value FROM health_logs WHERE device_id = ? AND type = 'steps' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(device_id, today);
    const water = db.prepare("SELECT SUM(CAST(value AS INTEGER)) as total FROM health_logs WHERE device_id = ? AND type = 'water' AND date(timestamp) = ?").get(device_id, today);
    const sleep = db.prepare("SELECT value FROM health_logs WHERE device_id = ? AND type = 'sleep' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(device_id, today);
    
    // Get step goal
    const stepGoal = db.prepare("SELECT value FROM settings WHERE key = 'step_goal'").get();
    
    res.json({
      mood: mood?.value || null,
      mood_time: mood?.timestamp || null,
      steps: steps?.value ? parseInt(steps.value) : 0,
      step_goal: stepGoal?.value ? parseInt(stepGoal.value) : 5000,
      water: water?.total || 0,
      sleep: sleep?.value ? parseFloat(sleep.value) : null
    });
  } catch (err) {
    console.error('Get today health error:', err);
    res.status(500).json({ error: 'Failed to get health data' });
  }
});

module.exports = router;
