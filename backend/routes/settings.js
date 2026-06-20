const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;

// Get all settings
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const settings = db.prepare('SELECT key, value FROM settings').all();
    
    // Convert to object
    const settingsObj = {};
    settings.forEach(s => {
      // Parse JSON values if applicable
      try {
        settingsObj[s.key] = JSON.parse(s.value);
      } catch {
        settingsObj[s.key] = s.value;
      }
    });
    
    // Get geofence
    const geofence = db.prepare("SELECT * FROM geofences WHERE device_id = 'demo_device' AND active = 1").get();
    settingsObj.geofence = geofence || null;
    
    // Get medications
    const medications = db.prepare("SELECT * FROM medications WHERE device_id = 'demo_device' AND active = 1").all();
    settingsObj.medications = medications;
    
    res.json(settingsObj);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.put('/', verifyToken, (req, res) => {
  try {
    const updates = req.body;
    const db = getDB();
    
    const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    
    Object.entries(updates).forEach(([key, value]) => {
      // Skip special fields
      if (['geofence', 'medications'].includes(key)) return;
      
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      updateSetting.run(key, valueStr, new Date().toISOString());
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Update geofence
router.put('/geofence', verifyToken, (req, res) => {
  try {
    const { latitude, longitude, radius, name } = req.body;
    
    if (!latitude || !longitude || !radius) {
      return res.status(400).json({ error: 'Latitude, longitude, and radius required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Deactivate existing geofences
    db.prepare("UPDATE geofences SET active = 0 WHERE device_id = 'demo_device'").run();
    
    // Create new geofence
    const result = db.prepare('INSERT INTO geofences (device_id, name, latitude, longitude, radius, active) VALUES (?, ?, ?, ?, ?, ?)').run(
      'demo_device',
      name || 'Home',
      latitude,
      longitude,
      radius,
      1
    );
    
    const geofence = {
      id: result.lastInsertRowid,
      name: name || 'Home',
      latitude,
      longitude,
      radius
    };
    
    // Notify app about new geofence
    io.to('app').emit('geofence:update', geofence);
    
    res.json(geofence);
  } catch (err) {
    console.error('Update geofence error:', err);
    res.status(500).json({ error: 'Failed to update geofence' });
  }
});

// Get geofence
router.get('/geofence', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const geofence = db.prepare("SELECT * FROM geofences WHERE device_id = 'demo_device' AND active = 1").get();
    
    if (!geofence) {
      return res.json({ message: 'No geofence set' });
    }
    
    res.json(geofence);
  } catch (err) {
    console.error('Get geofence error:', err);
    res.status(500).json({ error: 'Failed to get geofence' });
  }
});

// Add medication
router.post('/medications', verifyToken, (req, res) => {
  try {
    const { name, dosage, reminder_times } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Medication name required' });
    }
    
    const db = getDB();
    
    const result = db.prepare('INSERT INTO medications (device_id, name, dosage, reminder_times) VALUES (?, ?, ?, ?)').run(
      'demo_device',
      name,
      dosage || '',
      JSON.stringify(reminder_times || [])
    );
    
    res.json({
      id: result.lastInsertRowid,
      name,
      dosage,
      reminder_times
    });
  } catch (err) {
    console.error('Add medication error:', err);
    res.status(500).json({ error: 'Failed to add medication' });
  }
});

// Update medication
router.put('/medications/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, dosage, reminder_times, active } = req.body;
    
    const db = getDB();
    
    db.prepare('UPDATE medications SET name = ?, dosage = ?, reminder_times = ?, active = ? WHERE id = ?').run(
      name,
      dosage || '',
      JSON.stringify(reminder_times || []),
      active !== false ? 1 : 0,
      id
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update medication error:', err);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

// Delete medication
router.delete('/medications/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();
    
    db.prepare('UPDATE medications SET active = 0 WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete medication error:', err);
    res.status(500).json({ error: 'Failed to delete medication' });
  }
});

// Get medications
router.get('/medications', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const medications = db.prepare("SELECT * FROM medications WHERE device_id = 'demo_device' AND active = 1").all();
    
    // Parse reminder_times JSON
    const parsed = medications.map(m => ({
      ...m,
      reminder_times: JSON.parse(m.reminder_times || '[]')
    }));
    
    res.json(parsed);
  } catch (err) {
    console.error('Get medications error:', err);
    res.status(500).json({ error: 'Failed to get medications' });
  }
});

// Update father's profile
router.put('/profile', verifyToken, (req, res) => {
  try {
    const { name, phone_number, photo_url } = req.body;
    const db = getDB();
    
    db.prepare("UPDATE devices SET name = ?, phone_number = ? WHERE device_id = 'demo_device'").run(
      name || 'Father',
      phone_number || ''
    );
    
    // Update settings
    if (name) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('father_name', ?, ?)").run(
        name, new Date().toISOString()
      );
    }
    if (phone_number) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('father_phone', ?, ?)").run(
        phone_number, new Date().toISOString()
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
