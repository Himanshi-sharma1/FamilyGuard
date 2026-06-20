import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

let socket = null;
let eventHandlers = {};

export const connectSocket = (deviceId) => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    socket.emit('join:app', deviceId);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.log('[Socket] Connection error:', error.message);
  });

  // Handle incoming voice messages
  socket.on('voice:new', (data) => {
    if (eventHandlers.onVoiceMessage) {
      eventHandlers.onVoiceMessage(data);
    }
  });

  // Handle remote commands from dashboard
  socket.on('remote:audio:start', () => {
    if (eventHandlers.onRemoteAudioStart) {
      eventHandlers.onRemoteAudioStart();
    }
  });

  socket.on('remote:audio:stop', () => {
    if (eventHandlers.onRemoteAudioStop) {
      eventHandlers.onRemoteAudioStop();
    }
  });

  socket.on('remote:camera:start', () => {
    if (eventHandlers.onRemoteCameraStart) {
      eventHandlers.onRemoteCameraStart();
    }
  });

  socket.on('remote:camera:stop', () => {
    if (eventHandlers.onRemoteCameraStop) {
      eventHandlers.onRemoteCameraStop();
    }
  });

  // WebRTC signaling
  socket.on('call:offer', (data) => {
    if (eventHandlers.onCallOffer) {
      eventHandlers.onCallOffer(data);
    }
  });

  socket.on('call:answer', (data) => {
    if (eventHandlers.onCallAnswer) {
      eventHandlers.onCallAnswer(data);
    }
  });

  socket.on('call:ice-candidate', (data) => {
    if (eventHandlers.onIceCandidate) {
      eventHandlers.onIceCandidate(data);
    }
  });

  socket.on('call:hangup', () => {
    if (eventHandlers.onCallHangup) {
      eventHandlers.onCallHangup();
    }
  });

  return socket;
};

export const setEventHandler = (event, handler) => {
  eventHandlers[event] = handler;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// WebRTC signaling methods
export const sendCallOffer = (offer) => {
  if (socket) {
    socket.emit('call:offer', { offer });
  }
};

export const sendCallAnswer = (answer) => {
  if (socket) {
    socket.emit('call:answer', { answer });
  }
};

export const sendIceCandidate = (candidate) => {
  if (socket) {
    socket.emit('call:ice-candidate', { candidate });
  }
};

export const sendCallHangup = () => {
  if (socket) {
    socket.emit('call:hangup');
  }
};

// Audio/Camera streaming
export const startAudioStream = (deviceId) => {
  if (socket) {
    socket.emit('audio:stream:start', { deviceId });
  }
};

export const sendAudioChunk = (chunk) => {
  if (socket) {
    socket.emit('audio:stream:data', { chunk });
  }
};

export const stopAudioStream = () => {
  if (socket) {
    socket.emit('audio:stream:stop');
  }
};

export const startCameraStream = (deviceId) => {
  if (socket) {
    socket.emit('camera:stream:start', { deviceId });
  }
};

export const sendCameraFrame = (frame) => {
  if (socket) {
    socket.emit('camera:stream:frame', { frame });
  }
};

export const stopCameraStream = () => {
  if (socket) {
    socket.emit('camera:stream:stop');
  }
};
