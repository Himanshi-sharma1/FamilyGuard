import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { RTCView, mediaDevices } from 'react-native-webrtc';
import Tts from 'react-native-tts';
import {
  startCall,
  answerCall,
  endCall,
  setCallbacks,
  initWebRTCSignaling,
  getLocalStream,
} from '../services/webrtcService';
import { setEventHandler } from '../services/socket';

const VideoCallScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    requestPermissions();
    initWebRTCSignaling();

    setCallbacks(
      (stream) => {
        console.log('[VideoCall] Remote stream received');
        setRemoteStream(stream);
        setCallState('connected');
        Tts.speak('Call connected');
      },
      () => {
        console.log('[VideoCall] Call ended');
        setLocalStream(null);
        setRemoteStream(null);
        setCallState('idle');
        Tts.speak('Call ended');
      }
    );

    // Handle incoming calls
    setEventHandler('onCallOffer', async (data) => {
      console.log('[VideoCall] Incoming call');
      setCallState('incoming');
      Tts.speak('Incoming video call from family');
      // Auto-answer for elderly users
      setTimeout(async () => {
        try {
          const stream = await answerCall(data.offer, true);
          setLocalStream(stream);
          setCallState('connected');
        } catch (error) {
          console.log('Answer error:', error);
          setCallState('idle');
        }
      }, 2000);
    });

    return () => {
      endCall();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const hasAll =
          granted[PermissionsAndroid.PERMISSIONS.CAMERA] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(hasAll);
      } catch (err) {
        console.warn(err);
      }
    } else {
      setHasPermission(true);
    }
  };

  const handleStartCall = async () => {
    setCallState('calling');
    Tts.speak('Calling family');
    try {
      const stream = await startCall(true);
      setLocalStream(stream);
    } catch (error) {
      console.log('Start call error:', error);
      Alert.alert('Error', 'Failed to start call');
      setCallState('idle');
    }
  };

  const handleEndCall = () => {
    endCall();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera and microphone permissions are required for video calls
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote Video (Full Screen) */}
      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      )}

      {/* Placeholder when no remote stream */}
      {!remoteStream && (
        <View style={styles.placeholder}>
          {callState === 'idle' && (
            <>
              <Text style={styles.placeholderEmoji}>📞</Text>
              <Text style={styles.placeholderText}>Tap Call to connect with family</Text>
            </>
          )}
          {callState === 'calling' && (
            <>
              <Text style={styles.placeholderEmoji}>📱</Text>
              <Text style={styles.placeholderText}>Calling family...</Text>
            </>
          )}
          {callState === 'incoming' && (
            <>
              <Text style={styles.placeholderEmoji}>📲</Text>
              <Text style={styles.placeholderText}>Incoming call from family</Text>
              <Text style={styles.placeholderSubtext}>Connecting automatically...</Text>
            </>
          )}
        </View>
      )}

      {/* Local Video (Picture-in-Picture) */}
      {localStream && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.callControls}>
          {callState === 'idle' && (
            <TouchableOpacity style={styles.callButton} onPress={handleStartCall}>
              <Text style={styles.callButtonText}>📞 Call Family</Text>
            </TouchableOpacity>
          )}

          {(callState === 'calling' || callState === 'connected') && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                onPress={toggleMute}
              >
                <Text style={styles.controlButtonText}>{isMuted ? '🔇' : '🔊'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Text style={styles.endCallButtonText}>End Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
                onPress={toggleCamera}
              >
                <Text style={styles.controlButtonText}>{isCameraOff ? '📷' : '🎥'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2520',
  },
  remoteVideo: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#A0AAB2',
    marginTop: 8,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  localVideo: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  callButton: {
    backgroundColor: '#386641',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 30,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  endCallButton: {
    backgroundColor: '#C92A2A',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  endCallButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  controlButtonText: {
    fontSize: 24,
  },
  permissionText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#3E7C78',
    marginHorizontal: 40,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default VideoCallScreen;
