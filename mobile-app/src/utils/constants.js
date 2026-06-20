export const API_BASE_URL = 'http://YOUR_SERVER_IP:8888';
export const SOCKET_URL = 'http://YOUR_SERVER_IP:8888';
export const GPS_INTERVAL = 30000; // 30 seconds
export const HEARTBEAT_INTERVAL = 60000; // 1 minute
export const FALL_THRESHOLD = 4.0; // G-force
export const STILLNESS_THRESHOLD = 0.5;
export const SOS_HOLD_DURATION = 2000; // 2 seconds

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Great', value: 5 },
  { emoji: '🙂', label: 'Good', value: 4 },
  { emoji: '😐', label: 'Okay', value: 3 },
  { emoji: '😟', label: 'Not Good', value: 2 },
  { emoji: '😴', label: 'Tired', value: 1 },
];
