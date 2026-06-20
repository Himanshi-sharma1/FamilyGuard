import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { STUN_SERVERS } from '../utils/constants';
import {
  sendCallOffer,
  sendCallAnswer,
  sendIceCandidate,
  sendCallHangup,
  setEventHandler,
} from './socket';

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let onRemoteStreamCallback = null;
let onCallEndCallback = null;

const configuration = {
  iceServers: STUN_SERVERS,
};

export const setCallbacks = (onRemoteStream, onCallEnd) => {
  onRemoteStreamCallback = onRemoteStream;
  onCallEndCallback = onCallEnd;
};

const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendIceCandidate(event.candidate);
    }
  };

  peerConnection.onaddstream = (event) => {
    console.log('[WebRTC] Remote stream received');
    remoteStream = event.stream;
    if (onRemoteStreamCallback) {
      onRemoteStreamCallback(event.stream);
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ICE state:', peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === 'disconnected' || 
        peerConnection.iceConnectionState === 'failed') {
      endCall();
    }
  };

  return peerConnection;
};

export const startCall = async (isVideo = true) => {
  try {
    const constraints = {
      audio: true,
      video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
    };

    localStream = await mediaDevices.getUserMedia(constraints);
    console.log('[WebRTC] Got local stream');

    createPeerConnection();
    peerConnection.addStream(localStream);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendCallOffer(offer);
    console.log('[WebRTC] Offer sent');

    return localStream;
  } catch (error) {
    console.error('[WebRTC] Start call error:', error);
    throw error;
  }
};

export const answerCall = async (offer, isVideo = true) => {
  try {
    const constraints = {
      audio: true,
      video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
    };

    localStream = await mediaDevices.getUserMedia(constraints);
    console.log('[WebRTC] Got local stream for answer');

    createPeerConnection();
    peerConnection.addStream(localStream);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendCallAnswer(answer);
    console.log('[WebRTC] Answer sent');

    return localStream;
  } catch (error) {
    console.error('[WebRTC] Answer call error:', error);
    throw error;
  }
};

export const handleAnswer = async (answer) => {
  try {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Answer received and set');
    }
  } catch (error) {
    console.error('[WebRTC] Handle answer error:', error);
  }
};

export const handleIceCandidate = async (candidate) => {
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added');
    }
  } catch (error) {
    console.error('[WebRTC] Handle ICE error:', error);
  }
};

export const endCall = () => {
  console.log('[WebRTC] Ending call');
  
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteStream = null;
  sendCallHangup();
  
  if (onCallEndCallback) {
    onCallEndCallback();
  }
};

export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;

// Initialize socket event handlers for WebRTC
export const initWebRTCSignaling = () => {
  setEventHandler('onCallOffer', async (data) => {
    console.log('[WebRTC] Received call offer');
    // This will trigger incoming call UI
    if (onRemoteStreamCallback) {
      // Auto-answer for elderly-friendly experience
      await answerCall(data.offer, true);
    }
  });

  setEventHandler('onCallAnswer', async (data) => {
    console.log('[WebRTC] Received call answer');
    await handleAnswer(data.answer);
  });

  setEventHandler('onIceCandidate', async (data) => {
    await handleIceCandidate(data.candidate);
  });

  setEventHandler('onCallHangup', () => {
    console.log('[WebRTC] Call hangup received');
    endCall();
  });
};
