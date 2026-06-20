const express = require('express');
const { getDB } = require('../services/database');
const authRoutes = require('./auth');

const router = express.Router();
const verifyToken = authRoutes.verifyToken;

// Verify device token
const verifyDevice = (req, res, next) => {
  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) {
    return res.status(401).json({ error: 'Device token required' });
  }
  
  const db = getDB();
  const device = db.prepare('SELECT * FROM devices WHERE device_token = ?').get(deviceToken);
  
  if (!device) {
    return res.status(401).json({ error: 'Invalid device token' });
  }
  
  req.device = device;
  next();
};

// Post location from app
router.post('/', verifyDevice, (req, res) => {
  try {
    const { latitude, longitude, accuracy, speed, address, timestamp } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    const db = getDB();
    const io = req.app.get('io');
    
    // Insert location
    const result = db.prepare('INSERT INTO locations (device_id, latitude, longitude, accuracy, speed, address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      req.device.device_id,
      latitude,
      longitude,
      accuracy || 0,
      speed || 0,
      address || '',
      timestamp || new Date().toISOString()
    );
    
    // Update device last seen
    db.prepare('UPDATE devices SET last_seen = ? WHERE device_id = ?').run(new Date().toISOString(), req.device.device_id);
    
    // Update device status speed
    db.prepare('UPDATE device_status SET current_speed = ?, last_heartbeat = ? WHERE device_id = ?').run(
      speed || 0, new Date().toISOString(), req.device.device_id
    );
    
    // Check geofence
    const geofence = db.prepare('SELECT * FROM geofences WHERE device_id = ? AND active = 1').get(req.device.device_id);
    if (geofence) {
      const distance = calculateDistance(latitude, longitude, geofence.latitude, geofence.longitude);
      if (distance > geofence.radius) {
        // Create geofence alert
        const alertResult = db.prepare('INSERT INTO alerts (device_id, type, title, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)').run(
          req.device.device_id,
          'geofence',
          'Left Safe Zone',
          `Father has left the safe zone (${geofence.name}). Distance: ${Math.round(distance)}m`,
          latitude,
          longitude
        );
        
        // Emit alert to dashboard
        io.to('dashboard').emit('alert:new', {
          id: alertResult.lastInsertRowid,
          type: 'geofence',
          title: 'Left Safe Zone',
          message: `Father has left the safe zone. Distance: ${Math.round(distance)}m`,
          latitude,
          longitude,
          created_at: new Date().toISOString()
        });
      }
    }
    
    // Check speed alert
    const settings = db.prepare("SELECT value FROM settings WHERE key = 'speed_alert_kmh'").get();
    const speedThreshold = settings ? parseFloat(settings.value) : 80;
    const speedKmh = (speed || 0) * 3.6; // Convert m/s to km/h
    
    if (speedKmh > speedThreshold) {
      db.prepare('INSERT INTO alerts (device_id, type, title, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)').run(
        req.device.device_id,
        'speed',
        'High Speed Detected',
        `Father is moving at ${Math.round(speedKmh)} km/h`,
        latitude,
        longitude
      );
      
      io.to('dashboard').emit('alert:new', {
        type: 'speed',
        title: 'High Speed Detected',
        message: `Father is moving at ${Math.round(speedKmh)} km/h`,
        latitude,
        longitude,
        created_at: new Date().toISOString()
      });
    }
    
    // Emit location update to dashboard
    io.to('dashboard').emit('location:update', {
      latitude,
      longitude,
      accuracy,
      speed,
      address,
      timestamp: timestamp || new Date().toISOString()
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Post location error:', err);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// Batch upload locations (for offline sync)
router.post('/batch', verifyDevice, (req, res) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'Locations array required' });
    }
    
    const db = getDB();
    const insert = db.prepare('INSERT INTO locations (device_id, latitude, longitude, accuracy, speed, address, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    const insertMany = db.transaction((locs) => {
      for (const loc of locs) {
        insert.run(
          req.device.device_id,
          loc.latitude,
          loc.longitude,
          loc.accuracy || 0,
          loc.speed || 0,
          loc.address || '',
          loc.timestamp || new Date().toISOString(),
          1
        );
      }
    });
    
    insertMany(locations);
    
    res.json({ success: true, count: locations.length });
  } catch (err) {
    console.error('Batch location error:', err);
    res.status(500).json({ error: 'Failed to save locations' });
  }
});

// Get current location
router.get('/current', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const location = db.prepare('SELECT * FROM locations ORDER BY timestamp DESC LIMIT 1').get();
    
    if (!location) {
      return res.json({ message: 'No location data available' });
    }
    
    res.json(location);
  } catch (err) {
    console.error('Get current location error:', err);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// Get today's locations
router.get('/today', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    const locations = db.prepare("SELECT * FROM locations WHERE date(timestamp) = ? ORDER BY timestamp ASC").all(today);
    
    res.json(locations);
  } catch (err) {
    console.error('Get today locations error:', err);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

// Get location history for specific date
router.get('/history', verifyToken, (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }
    
    const db = getDB();
    const locations = db.prepare("SELECT * FROM locations WHERE date(timestamp) = ? ORDER BY timestamp ASC").all(date);
    
    res.json(locations);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get location range
router.get('/range', verifyToken, (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'From and to dates required' });
    }
    
    const db = getDB();
    const locations = db.prepare("SELECT * FROM locations WHERE date(timestamp) BETWEEN ? AND ? ORDER BY timestamp ASC").all(from, to);
    
    res.json(locations);
  } catch (err) {
    console.error('Get range error:', err);
    res.status(500).json({ error: 'Failed to get range' });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

router.verifyDevice = verifyDevice;

module.exports = router;
