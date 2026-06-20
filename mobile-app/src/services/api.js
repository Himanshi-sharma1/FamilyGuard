import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add device token to all requests
api.interceptors.request.use(async (config) => {
  const deviceToken = await AsyncStorage.getItem('device_token');
  if (deviceToken) {
    config.headers['x-device-token'] = deviceToken;
  }
  return config;
});

// Device registration
export const registerDevice = async (deviceId, name = 'Father') => {
  const response = await api.post('/api/v1/auth/app-register', {
    device_id: deviceId,
    name,
    consent_given: true,
  });
  await AsyncStorage.setItem('device_token', response.data.device_token);
  return response.data;
};

// Location APIs
export const sendLocation = async (latitude, longitude, accuracy, speed) => {
  return api.post('/api/v1/location', {
    latitude,
    longitude,
    accuracy,
    speed,
    timestamp: new Date().toISOString(),
  });
};

export const batchSyncLocations = async (locations) => {
  return api.post('/api/v1/location/batch', { locations });
};

// Check-in API
export const sendCheckin = async (latitude, longitude, photoUrl) => {
  return api.post('/api/v1/checkin', {
    latitude,
    longitude,
    photo_url: photoUrl,
    timestamp: new Date().toISOString(),
  });
};

// SOS API
export const triggerSOS = async (latitude, longitude, photoUrl, voiceUrl) => {
  return api.post('/api/v1/sos', {
    latitude,
    longitude,
    photo_url: photoUrl,
    voice_url: voiceUrl,
    timestamp: new Date().toISOString(),
  });
};

// Health APIs
export const logMood = async (value, notes = '') => {
  return api.post('/api/v1/health/mood', { value, notes });
};

export const logWater = async (glasses = 1) => {
  return api.post('/api/v1/health/water', { glasses });
};

export const logMedication = async (medicationId) => {
  return api.post('/api/v1/health/medication', { medication_id: medicationId, taken: true });
};

export const syncSteps = async (steps) => {
  return api.post('/api/v1/health/steps', { value: steps });
};

// Status/Heartbeat API
export const sendHeartbeat = async (batteryLevel, isCharging) => {
  return api.post('/api/v1/status', {
    battery_level: batteryLevel,
    is_charging: isCharging,
  });
};

// Media upload
export const uploadPhoto = async (photoUri, latitude, longitude) => {
  const formData = new FormData();
  formData.append('photo', {
    uri: photoUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  });
  if (latitude) formData.append('latitude', latitude);
  if (longitude) formData.append('longitude', longitude);

  const deviceToken = await AsyncStorage.getItem('device_token');
  return axios.post(`${API_BASE_URL}/api/v1/media/photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-device-token': deviceToken,
    },
  });
};

export const uploadVoice = async (voiceUri, duration) => {
  const formData = new FormData();
  formData.append('voice', {
    uri: voiceUri,
    name: 'voice.mp3',
    type: 'audio/mpeg',
  });
  if (duration) formData.append('duration', duration);

  const deviceToken = await AsyncStorage.getItem('device_token');
  return axios.post(`${API_BASE_URL}/api/v1/media/voice`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-device-token': deviceToken,
    },
  });
};

export default api;
