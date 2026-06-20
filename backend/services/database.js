const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

let db = null;

const initDB = async () => {
  const dbPath = path.join(__dirname, "../database/familyguard.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  
  // Create tables
  db.exec(`
    -- Users table (dashboard users)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'family',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
    
    -- Devices table (father phone)
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      device_token TEXT UNIQUE,
      name TEXT DEFAULT 'Father',
      phone_number TEXT,
      photo_url TEXT,
      consent_given INTEGER DEFAULT 0,
      consent_timestamp DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME
    );
    
    -- Locations table
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 1
    );
    
    -- Alerts table
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      latitude REAL,
      longitude REAL,
      address TEXT,
      photo_url TEXT,
      is_read INTEGER DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Health logs table
    CREATE TABLE IF NOT EXISTS health_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT,
      notes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Medications table
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT,
      reminder_times TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Medication logs table
    CREATE TABLE IF NOT EXISTS medication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      taken INTEGER DEFAULT 1,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications(id)
    );
    
    -- Check-ins table
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      address TEXT,
      photo_url TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- SOS events table
    CREATE TABLE IF NOT EXISTS sos_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      address TEXT,
      photo_url TEXT,
      voice_url TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Media table (photos and voice messages)
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_url TEXT,
      thumbnail_path TEXT,
      duration INTEGER,
      latitude REAL,
      longitude REAL,
      direction TEXT DEFAULT 'from_app',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Device status table
    CREATE TABLE IF NOT EXISTS device_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      battery_level INTEGER,
      is_charging INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 1,
      current_speed REAL DEFAULT 0,
      last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Geofence table
    CREATE TABLE IF NOT EXISTS geofences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT DEFAULT 'Home',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Screenshots table (for screen view feature)
    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Login attempts (brute force protection)
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_locations_device_timestamp ON locations(device_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_alerts_device_type ON alerts(device_id, type);
    CREATE INDEX IF NOT EXISTS idx_health_device_type ON health_logs(device_id, type);
    CREATE INDEX IF NOT EXISTS idx_checkins_device ON checkins(device_id);
    CREATE INDEX IF NOT EXISTS idx_media_device_type ON media(device_id, type);
  `);
  
  // Seed admin user
  const adminUser = db.prepare("SELECT * FROM users WHERE username = ?").get(process.env.ADMIN_USERNAME);
  if (!adminUser) {
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)").run(
      process.env.ADMIN_USERNAME,
      hashedPassword,
      "Admin",
      "admin"
    );
    console.log("Admin user created");
  }
  
  // Seed default settings
  const defaultSettings = [
    { key: "checkin_interval_hours", value: "4" },
    { key: "inactivity_threshold_hours", value: "6" },
    { key: "speed_alert_kmh", value: "80" },
    { key: "battery_alert_level", value: "20" },
    { key: "step_goal", value: "5000" },
    { key: "wake_time", value: "07:00" },
    { key: "sleep_time", value: "22:00" },
    { key: "father_name", value: "Father" },
    { key: "father_phone", value: "" },
    { key: "emergency_contacts", value: "[]" }
  ];
  
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  defaultSettings.forEach(s => insertSetting.run(s.key, s.value));
  
  // Seed demo device
  const device = db.prepare("SELECT * FROM devices WHERE device_id = ?").get("demo_device");
  if (!device) {
    db.prepare("INSERT INTO devices (device_id, device_token, name, consent_given, consent_timestamp) VALUES (?, ?, ?, ?, ?)").run(
      "demo_device",
      "demo_token_123",
      "Father",
      1,
      new Date().toISOString()
    );
    
    // Seed demo device status
    db.prepare("INSERT INTO device_status (device_id, battery_level, is_charging, is_online) VALUES (?, ?, ?, ?)").run(
      "demo_device", 75, 0, 1
    );
    
    // Seed default geofence (example: Delhi center)
    db.prepare("INSERT INTO geofences (device_id, name, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)").run(
      "demo_device", "Home", 28.6139, 77.2090, 500
    );
    
    // Seed some demo data
    seedDemoData();
    console.log("Demo device and data created");
  }
  
  console.log("Database initialized successfully");
  return db;
};

const seedDemoData = () => {
  const now = new Date();
  
  // Seed some location history for today
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // Every 30 min for past 12 hours
    const lat = 28.6139 + (Math.random() - 0.5) * 0.01;
    const lng = 77.2090 + (Math.random() - 0.5) * 0.01;
    db.prepare("INSERT INTO locations (device_id, latitude, longitude, accuracy, speed, timestamp) VALUES (?, ?, ?, ?, ?, ?)").run(
      "demo_device", lat, lng, 10 + Math.random() * 5, Math.random() * 5, timestamp.toISOString()
    );
  }
  
  // Seed health data
  const moods = ["happy", "neutral", "sad", "tired", "sick"];
  for (let i = 0; i < 7; i++) {
    const timestamp = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
    db.prepare("INSERT INTO health_logs (device_id, type, value, timestamp) VALUES (?, ?, ?, ?)").run(
      "demo_device", "mood", moods[Math.floor(Math.random() * moods.length)], timestamp.toISOString()
    );
    db.prepare("INSERT INTO health_logs (device_id, type, value, timestamp) VALUES (?, ?, ?, ?)").run(
      "demo_device", "steps", String(3000 + Math.floor(Math.random() * 4000)), timestamp.toISOString()
    );
    db.prepare("INSERT INTO health_logs (device_id, type, value, timestamp) VALUES (?, ?, ?, ?)").run(
      "demo_device", "water", String(4 + Math.floor(Math.random() * 6)), timestamp.toISOString()
    );
    db.prepare("INSERT INTO health_logs (device_id, type, value, timestamp) VALUES (?, ?, ?, ?)").run(
      "demo_device", "sleep", String(5 + Math.floor(Math.random() * 4)), timestamp.toISOString()
    );
  }
  
  // Seed a check-in
  db.prepare("INSERT INTO checkins (device_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)").run(
    "demo_device", 28.6139, 77.2090, now.toISOString()
  );
  
  // Seed some alerts
  db.prepare("INSERT INTO alerts (device_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "demo_device", "battery", "Low Battery", "Battery level is at 18%", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  );
  db.prepare("INSERT INTO alerts (device_id, type, title, message, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "demo_device", "geofence", "Left Safe Zone", "Father has left the safe zone", 28.6200, 77.2150, new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
  );
};

const getDB = () => {
  if (!db) throw new Error("Database not initialized");
  return db;
};

module.exports = { initDB, getDB };

// Add audio recordings table (run this separately if table doesn't exist)
const addAudioRecordingsTable = () => {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_url TEXT,
      duration INTEGER,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      is_live INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_audio_device_time ON audio_recordings(device_id, start_time);
  `);
  console.log('Audio recordings table created');
};

module.exports.addAudioRecordingsTable = addAudioRecordingsTable;
