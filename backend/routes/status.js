const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');
const locationRoutes = require('./location');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;
const verifyDevice = locationRoutes.verifyDevice;

// App heartbeat / status update (from app)
router.post('/', verifyDevice, (req, res) => {
  try {
    const { battery_level, is_charging } = req.body;
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Update device status
    db.prepare('UPDATE device_status SET battery_level = ?, is_charging = ?, is_online = 1, last_heartbeat = ? WHERE device_id = ?').run(
      battery_level !== undefined ? battery_level : null,
      is_charging ? 1 : 0,
      new Date().toISOString(),
      req.device.device_id
    );
    
    // Update device last seen
    db.prepare('UPDATE devices SET last_seen = ? WHERE device_id = ?').run(
      new Date().toISOString(),
      req.device.device_id
    );
    
    // Check battery alert
    if (battery_level !== undefined) {
      const settings = db.prepare("SELECT value FROM settings WHERE key = 'battery_alert_level'").get();
      const threshold = settings ? parseInt(settings.value) : 20;
      
      if (battery_level <= threshold && !is_charging) {
        // Check if we already sent a battery alert recently (within last hour)
        const recentAlert = db.prepare("SELECT * FROM alerts WHERE type = 'battery' AND created_at > datetime('now', '-1 hour')").get();
        
        if (!recentAlert) {
          db.prepare('INSERT INTO alerts (device_id, type, title, message) VALUES (?, ?, ?, ?)').run(
            req.device.device_id,
            'battery',
            'Low Battery',
            `Father's phone battery is at ${battery_level}%`
          );
          
          io.to('dashboard').emit('alert:new', {
            type: 'battery',
            title: 'Low Battery',
            message: `Father's phone battery is at ${battery_level}%`,
            created_at: new Date().toISOString()
          });
        }
      }
    }
    
    // Emit status update to dashboard
    io.to('dashboard').emit('status:change', {
      battery_level,
      is_charging,
      is_online: true,
      last_heartbeat: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get device status (dashboard)
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDB();
    
    // Get device info
    const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get('demo_device');
    
    // Get device status
    const status = db.prepare('SELECT * FROM device_status WHERE device_id = ?').get('demo_device');
    
    // Get latest location
    const location = db.prepare('SELECT * FROM locations ORDER BY timestamp DESC LIMIT 1').get();
    
    // Get latest check-in
    const checkin = db.prepare('SELECT * FROM checkins ORDER BY timestamp DESC LIMIT 1').get();
    
    // Check if offline (no heartbeat in 15 minutes)
    let isOnline = true;
    if (status && status.last_heartbeat) {
      const lastHeartbeat = new Date(status.last_heartbeat);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      isOnline = lastHeartbeat > fifteenMinutesAgo;
    }
    
    // Get today's health snapshot
    const today = new Date().toISOString().split('T')[0];
    const mood = db.prepare("SELECT value FROM health_logs WHERE device_id = 'demo_device' AND type = 'mood' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(today);
    const steps = db.prepare("SELECT value FROM health_logs WHERE device_id = 'demo_device' AND type = 'steps' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(today);
    
    res.json({
      device: {
        id: device?.device_id,
        name: device?.name || 'Father',
        phone_number: device?.phone_number,
        photo_url: device?.photo_url,
        consent_given: device?.consent_given === 1,
        last_seen: device?.last_seen
      },
      status: {
        battery_level: status?.battery_level || 100,
        is_charging: status?.is_charging === 1,
        is_online: isOnline,
        current_speed: status?.current_speed || 0,
        last_heartbeat: status?.last_heartbeat
      },
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        address: location.address,
        timestamp: location.timestamp
      } : null,
      last_checkin: checkin ? {
        timestamp: checkin.timestamp,
        photo_url: checkin.photo_url
      } : null,
      today: {
        mood: mood?.value || null,
        steps: steps?.value ? parseInt(steps.value) : 0
      }
    });
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Get full device details
router.get('/device', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get('demo_device');
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
      id: device.device_id,
      name: device.name,
      phone_number: device.phone_number,
      photo_url: device.photo_url,
      consent_given: device.consent_given === 1,
      consent_timestamp: device.consent_timestamp,
      created_at: device.created_at,
      last_seen: device.last_seen
    });
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Failed to get device' });
  }
});

module.exports = router;
