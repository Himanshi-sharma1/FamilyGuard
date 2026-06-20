import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTimer from 'react-native-background-timer';
import { sendLocation, batchSyncLocations } from './api';
import { GPS_INTERVAL } from '../utils/constants';

let watchId = null;
let backgroundTimerId = null;
let offlineLocations = [];

export const requestLocationPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const fineLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'FamilyGuard Location Permission',
          message: 'FamilyGuard needs access to your location for safety monitoring.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (fineLocation === PermissionsAndroid.RESULTS.GRANTED) {
        // Request background location for Android 10+
        if (Platform.Version >= 29) {
          const backgroundLocation = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'FamilyGuard Background Location',
              message: 'Allow FamilyGuard to access your location in the background for continuous safety monitoring.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          return backgroundLocation === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Location permission error:', err);
      return false;
    }
  }
  return true;
};

export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

const saveOfflineLocation = async (location) => {
  offlineLocations.push({
    ...location,
    timestamp: new Date().toISOString(),
  });
  // Keep only last 500 points
  if (offlineLocations.length > 500) {
    offlineLocations = offlineLocations.slice(-500);
  }
  await AsyncStorage.setItem('offline_locations', JSON.stringify(offlineLocations));
};

const syncOfflineLocations = async () => {
  if (offlineLocations.length > 0) {
    try {
      await batchSyncLocations(offlineLocations);
      offlineLocations = [];
      await AsyncStorage.removeItem('offline_locations');
      console.log('[GPS] Offline locations synced');
    } catch (error) {
      console.log('[GPS] Failed to sync offline locations:', error.message);
    }
  }
};

const sendLocationUpdate = async () => {
  try {
    const location = await getCurrentLocation();
    await sendLocation(
      location.latitude,
      location.longitude,
      location.accuracy,
      location.speed
    );
    console.log('[GPS] Location sent:', location.latitude, location.longitude);
    
    // Try to sync offline locations
    await syncOfflineLocations();
  } catch (error) {
    console.log('[GPS] Error sending location:', error.message);
    // Save for later sync
    try {
      const location = await getCurrentLocation();
      await saveOfflineLocation(location);
    } catch (e) {
      console.log('[GPS] Could not get location:', e.message);
    }
  }
};

export const startLocationTracking = async () => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    console.log('[GPS] Permission denied');
    return false;
  }

  // Load any offline locations
  const stored = await AsyncStorage.getItem('offline_locations');
  if (stored) {
    offlineLocations = JSON.parse(stored);
  }

  // Send initial location
  await sendLocationUpdate();

  // Start background timer for periodic updates
  BackgroundTimer.runBackgroundTimer(async () => {
    await sendLocationUpdate();
  }, GPS_INTERVAL);

  backgroundTimerId = true;
  console.log('[GPS] Background tracking started');
  return true;
};

export const stopLocationTracking = () => {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (backgroundTimerId) {
    BackgroundTimer.stopBackgroundTimer();
    backgroundTimerId = null;
  }
  console.log('[GPS] Tracking stopped');
};
