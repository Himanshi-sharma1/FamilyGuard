const cron = require('node-cron');
const { getDB } = require('./database');

let schedulerIO = null;

const initScheduler = (io) => {
  schedulerIO = io;
  
  // Check for offline device every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    checkOfflineStatus();
  });
  
  // Check for missed check-ins every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    checkMissedCheckins();
  });
  
  // Check for inactivity every hour
  cron.schedule('0 * * * *', () => {
    checkInactivity();
  });
  
  // Generate daily summary at 8 PM
  cron.schedule('0 20 * * *', () => {
    generateDailySummary();
  });
  
  console.log('Scheduler initialized');
};

const checkOfflineStatus = () => {
  try {
    const db = getDB();
    const status = db.prepare("SELECT * FROM device_status WHERE device_id = 'demo_device'").get();
    
    if (status && status.last_heartbeat) {
      const lastHeartbeat = new Date(status.last_heartbeat);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      if (lastHeartbeat < fifteenMinutesAgo && status.is_online === 1) {
        // Mark as offline
        db.prepare("UPDATE device_status SET is_online = 0 WHERE device_id = 'demo_device'").run();
        
        // Check if we already sent an offline alert recently
        const recentAlert = db.prepare("SELECT * FROM alerts WHERE type = 'offline' AND created_at > datetime('now', '-1 hour')").get();
        
        if (!recentAlert) {
          // Create offline alert
          db.prepare("INSERT INTO alerts (device_id, type, title, message) VALUES (?, ?, ?, ?)").run(
            'demo_device',
            'offline',
            'Device Offline',
            "Father's phone has been offline for 15 minutes"
          );
          
          if (schedulerIO) {
            schedulerIO.to('dashboard').emit('alert:new', {
              type: 'offline',
              title: 'Device Offline',
              message: "Father's phone has been offline for 15 minutes",
              created_at: new Date().toISOString()
            });
            
            schedulerIO.to('dashboard').emit('status:change', {
              is_online: false,
              last_heartbeat: status.last_heartbeat
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Check offline error:', err);
  }
};

const checkMissedCheckins = () => {
  try {
    const db = getDB();
    
    // Get check-in interval setting
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'checkin_interval_hours'").get();
    const intervalHours = setting ? parseInt(setting.value) : 4;
    
    // Get last check-in
    const lastCheckin = db.prepare("SELECT * FROM checkins WHERE device_id = 'demo_device' ORDER BY timestamp DESC LIMIT 1").get();
    
    if (lastCheckin) {
      const lastCheckinTime = new Date(lastCheckin.timestamp);
      const thresholdTime = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
      
      if (lastCheckinTime < thresholdTime) {
        // Check if we already sent a missed check-in alert recently
        const recentAlert = db.prepare("SELECT * FROM alerts WHERE type = 'missed_checkin' AND created_at > datetime('now', '-1 hour')").get();
        
        if (!recentAlert) {
          db.prepare("INSERT INTO alerts (device_id, type, title, message) VALUES (?, ?, ?, ?)").run(
            'demo_device',
            'missed_checkin',
            'Missed Check-in',
            `Father hasn't checked in for ${intervalHours} hours`
          );
          
          if (schedulerIO) {
            schedulerIO.to('dashboard').emit('alert:new', {
              type: 'missed_checkin',
              title: 'Missed Check-in',
              message: `Father hasn't checked in for ${intervalHours} hours`,
              created_at: new Date().toISOString()
            });
            
            // Also notify the app to show a reminder
            schedulerIO.to('app').emit('checkin:reminder', {
              message: 'Please press I Am Safe button'
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Check missed checkins error:', err);
  }
};

const checkInactivity = () => {
  try {
    const db = getDB();
    
    // Get inactivity threshold setting
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'inactivity_threshold_hours'").get();
    const thresholdHours = setting ? parseInt(setting.value) : 6;
    
    // Get wake/sleep time settings
    const wakeTimeSetting = db.prepare("SELECT value FROM settings WHERE key = 'wake_time'").get();
    const sleepTimeSetting = db.prepare("SELECT value FROM settings WHERE key = 'sleep_time'").get();
    
    const wakeTime = wakeTimeSetting ? wakeTimeSetting.value : '07:00';
    const sleepTime = sleepTimeSetting ? sleepTimeSetting.value : '22:00';
    
    // Check if current time is within wake hours
    const now = new Date();
    const currentHour = now.getHours();
    const wakeHour = parseInt(wakeTime.split(':')[0]);
    const sleepHour = parseInt(sleepTime.split(':')[0]);
    
    // Only check inactivity during wake hours
    if (currentHour >= wakeHour && currentHour < sleepHour) {
      // Get locations from the last threshold hours
      const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
      const locations = db.prepare("SELECT * FROM locations WHERE device_id = 'demo_device' AND timestamp > ? ORDER BY timestamp ASC").all(thresholdTime.toISOString());
      
      if (locations.length >= 2) {
        // Calculate total movement
        let totalDistance = 0;
        for (let i = 1; i < locations.length; i++) {
          totalDistance += calculateDistance(
            locations[i-1].latitude, locations[i-1].longitude,
            locations[i].latitude, locations[i].longitude
          );
        }
        
        // If total movement is less than 50 meters, consider it inactive
        if (totalDistance < 50) {
          const recentAlert = db.prepare("SELECT * FROM alerts WHERE type = 'inactivity' AND created_at > datetime('now', '-2 hour')").get();
          
          if (!recentAlert) {
            db.prepare("INSERT INTO alerts (device_id, type, title, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)").run(
              'demo_device',
              'inactivity',
              'No Movement Detected',
              `Father has not moved significantly for ${thresholdHours} hours`,
              locations[locations.length - 1].latitude,
              locations[locations.length - 1].longitude
            );
            
            if (schedulerIO) {
              schedulerIO.to('dashboard').emit('alert:new', {
                type: 'inactivity',
                title: 'No Movement Detected',
                message: `Father has not moved significantly for ${thresholdHours} hours`,
                latitude: locations[locations.length - 1].latitude,
                longitude: locations[locations.length - 1].longitude,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Check inactivity error:', err);
  }
};

const generateDailySummary = () => {
  try {
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's stats
    const locations = db.prepare("SELECT * FROM locations WHERE device_id = 'demo_device' AND date(timestamp) = ?").all(today);
    const steps = db.prepare("SELECT value FROM health_logs WHERE device_id = 'demo_device' AND type = 'steps' AND date(timestamp) = ? ORDER BY timestamp DESC LIMIT 1").get(today);
    const checkins = db.prepare("SELECT COUNT(*) as count FROM checkins WHERE device_id = 'demo_device' AND date(timestamp) = ?").get(today);
    const alerts = db.prepare("SELECT type, COUNT(*) as count FROM alerts WHERE device_id = 'demo_device' AND date(created_at) = ? GROUP BY type").all(today);
    
    // Calculate unique places visited (group by ~100m radius)
    const places = [];
    locations.forEach(loc => {
      const existing = places.find(p => 
        calculateDistance(p.latitude, p.longitude, loc.latitude, loc.longitude) < 100
      );
      if (!existing) {
        places.push({ latitude: loc.latitude, longitude: loc.longitude });
      }
    });
    
    const summary = {
      date: today,
      steps: steps?.value ? parseInt(steps.value) : 0,
      locations_recorded: locations.length,
      places_visited: places.length,
      checkins: checkins.count,
      alerts: alerts.reduce((acc, a) => { acc[a.type] = a.count; return acc; }, {})
    };
    
    // Store summary in settings
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(
      `daily_summary_${today}`,
      JSON.stringify(summary),
      new Date().toISOString()
    );
    
    if (schedulerIO) {
      schedulerIO.to('dashboard').emit('summary:daily', summary);
    }
    
    console.log('Daily summary generated:', summary);
  } catch (err) {
    console.error('Generate daily summary error:', err);
  }
};

// Helper function
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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

module.exports = { initScheduler };
