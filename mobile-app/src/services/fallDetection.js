import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { Alert, Vibration } from 'react-native';
import Tts from 'react-native-tts';
import { triggerSOS } from './api';
import { getCurrentLocation } from './locationService';
import { FALL_THRESHOLD, STILLNESS_THRESHOLD } from '../utils/constants';

let subscription = null;
let recentReadings = [];
let fallDetected = false;
let alertTimeout = null;
let onFallCallback = null;

export const setFallCallback = (callback) => {
  onFallCallback = callback;
};

const handleFallDetected = async () => {
  if (fallDetected) return;
  fallDetected = true;

  console.log('[FALL] Fall detected!');
  Vibration.vibrate([500, 500, 500, 500]);

  if (onFallCallback) {
    onFallCallback();
  }

  try {
    Tts.speak('Fall detected. Are you okay? Press I Am Safe if you are fine.');
  } catch (e) {
    console.log('[TTS] Error:', e.message);
  }

  // If no response in 30 seconds, send alert
  alertTimeout = setTimeout(async () => {
    try {
      const location = await getCurrentLocation();
      await triggerSOS(location.latitude, location.longitude, null, null);
      console.log('[FALL] SOS sent automatically');
    } catch (error) {
      console.log('[FALL] Error sending SOS:', error.message);
    }
  }, 30000);
};

export const dismissFallAlert = () => {
  fallDetected = false;
  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }
  console.log('[FALL] Alert dismissed');
};

export const startFallDetection = () => {
  setUpdateIntervalForType(SensorTypes.accelerometer, 200);

  subscription = accelerometer.subscribe(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    recentReadings.push(magnitude);
    if (recentReadings.length > 50) {
      recentReadings.shift();
    }

    // Detect sudden high acceleration (potential fall)
    if (magnitude > FALL_THRESHOLD && !fallDetected) {
      // Wait 3 seconds to confirm stillness (person on ground)
      setTimeout(() => {
        if (recentReadings.length >= 10) {
          const avgRecent = recentReadings.slice(-10).reduce((a, b) => a + b, 0) / 10;
          if (avgRecent < STILLNESS_THRESHOLD) {
            handleFallDetected();
          }
        }
      }, 3000);
    }
  });

  console.log('[FALL] Detection started');
};

export const stopFallDetection = () => {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
  recentReadings = [];
  fallDetected = false;
  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }
  console.log('[FALL] Detection stopped');
};
