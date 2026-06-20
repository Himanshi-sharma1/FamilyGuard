const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../services/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Brute force protection
const checkBruteForce = (identifier) => {
  const db = getDB();
  const attempt = db.prepare('SELECT * FROM login_attempts WHERE identifier = ?').get(identifier);
  
  if (attempt && attempt.locked_until) {
    const lockedUntil = new Date(attempt.locked_until);
    if (lockedUntil > new Date()) {
      return { locked: true, until: lockedUntil };
    }
  }
  return { locked: false };
};

const recordFailedAttempt = (identifier) => {
  const db = getDB();
  const attempt = db.prepare('SELECT * FROM login_attempts WHERE identifier = ?').get(identifier);
  
  if (attempt) {
    const newAttempts = attempt.attempts + 1;
    if (newAttempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
      db.prepare('UPDATE login_attempts SET attempts = ?, locked_until = ? WHERE identifier = ?').run(
        newAttempts, lockedUntil.toISOString(), identifier
      );
    } else {
      db.prepare('UPDATE login_attempts SET attempts = ? WHERE identifier = ?').run(newAttempts, identifier);
    }
  } else {
    db.prepare('INSERT INTO login_attempts (identifier, attempts) VALUES (?, ?)').run(identifier, 1);
  }
};

const clearAttempts = (identifier) => {
  const db = getDB();
  db.prepare('DELETE FROM login_attempts WHERE identifier = ?').run(identifier);
};

// Dashboard login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const identifier = req.ip + ':' + username;
    const bruteCheck = checkBruteForce(identifier);
    if (bruteCheck.locked) {
      return res.status(429).json({ 
        error: 'Too many failed attempts. Try again later.',
        locked_until: bruteCheck.until 
      });
    }
    
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      recordFailedAttempt(identifier);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    clearAttempts(identifier);
    
    // Update last login
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// App device registration
router.post('/app-register', (req, res) => {
  try {
    const { device_id, name, phone_number, consent_given } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Device ID required' });
    }
    
    const db = getDB();
    const existingDevice = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
    
    const deviceToken = uuidv4();
    
    if (existingDevice) {
      // Update existing device
      db.prepare('UPDATE devices SET device_token = ?, name = ?, phone_number = ?, consent_given = ?, consent_timestamp = ?, last_seen = ? WHERE device_id = ?').run(
        deviceToken,
        name || existingDevice.name,
        phone_number || existingDevice.phone_number,
        consent_given ? 1 : existingDevice.consent_given,
        consent_given ? new Date().toISOString() : existingDevice.consent_timestamp,
        new Date().toISOString(),
        device_id
      );
    } else {
      // Create new device
      db.prepare('INSERT INTO devices (device_id, device_token, name, phone_number, consent_given, consent_timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(
        device_id,
        deviceToken,
        name || 'Father',
        phone_number || '',
        consent_given ? 1 : 0,
        consent_given ? new Date().toISOString() : null
      );
      
      // Initialize device status
      db.prepare('INSERT INTO device_status (device_id, battery_level, is_online) VALUES (?, ?, ?)').run(
        device_id, 100, 1
      );
    }
    
    res.json({
      device_token: deviceToken,
      message: 'Device registered successfully'
    });
  } catch (err) {
    console.error('App register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Add family member (admin only)
router.post('/add-member', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, password, name, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const db = getDB();
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)').run(
      username, hashedPassword, name || username, email || '', 'family'
    );
    
    res.json({
      id: result.lastInsertRowid,
      username,
      name: name || username,
      message: 'Family member added successfully'
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Get current user
router.get('/me', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT id, username, name, role, email, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get all family members (admin only)
router.get('/members', verifyToken, (req, res) => {
  try {
    const db = getDB();
    const members = db.prepare('SELECT id, username, name, role, email, created_at, last_login FROM users').all();
    res.json(members);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Verify token middleware export
router.verifyToken = verifyToken;

module.exports = router;
