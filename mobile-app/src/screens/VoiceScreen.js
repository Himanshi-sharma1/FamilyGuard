import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Tts from 'react-native-tts';
import { uploadVoice } from '../services/api';

const audioRecorderPlayer = new AudioRecorderPlayer();

const VoiceScreen = ({ navigation }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [recordedUri, setRecordedUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    requestMicPermission();
    return () => {
      audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        const granted =
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(granted);
      } catch (err) {
        console.warn(err);
      }
    } else {
      setHasPermission(true);
    }
  };

  const startRecording = async () => {
    try {
      const result = await audioRecorderPlayer.startRecorder();
      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordTime(audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)));
      });
      setIsRecording(true);
      setRecordedUri(null);
      Tts.speak('Recording started. Tap stop when done.');
    } catch (error) {
      console.log('Recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordedUri(result);
      Tts.speak('Recording stopped. Tap play to listen, or send to family.');
    } catch (error) {
      console.log('Stop recording error:', error);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;
    try {
      await audioRecorderPlayer.startPlayer(recordedUri);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration) {
          audioRecorderPlayer.stopPlayer();
          setIsPlaying(false);
        }
      });
      setIsPlaying(true);
    } catch (error) {
      console.log('Play error:', error);
    }
  };

  const stopPlaying = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      setIsPlaying(false);
    } catch (error) {
      console.log('Stop play error:', error);
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedUri) return;
    setUploading(true);
    try {
      await uploadVoice(recordedUri, recordTime);
      Tts.speak('Voice message sent to your family.');
      Alert.alert('✅ Sent', 'Voice message has been sent to your family.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.log('Upload error:', error.message);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    }
    setUploading(false);
  };

  const resetRecording = () => {
    setRecordedUri(null);
    setRecordTime('00:00');
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Microphone permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestMicPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Voice Message</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>{recordTime}</Text>
          <Text style={styles.timerLabel}>
            {isRecording ? 'Recording...' : recordedUri ? 'Recorded' : 'Ready to record'}
          </Text>
        </View>

        {/* Recording Controls */}
        {!recordedUri && (
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <View style={[styles.recordButtonInner, isRecording && styles.recordButtonStop]} />
          </TouchableOpacity>
        )}

        {!recordedUri && (
          <Text style={styles.hint}>
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
          </Text>
        )}

        {/* Playback Controls */}
        {recordedUri && !isRecording && (
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={isPlaying ? stopPlaying : playRecording}
            >
              <Text style={styles.playButtonText}>{isPlaying ? '⏹ Stop' : '▶ Play'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.rerecordButton} onPress={resetRecording}>
              <Text style={styles.rerecordButtonText}>↺ Re-record</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Send Button */}
        {recordedUri && !isRecording && (
          <TouchableOpacity
            style={[styles.sendButton, uploading && styles.sendButtonDisabled]}
            onPress={sendVoiceMessage}
            disabled={uploading}
          >
            <Text style={styles.sendButtonText}>
              {uploading ? 'Sending...' : '📤 Send to Family'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E0D8',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 18,
    color: '#3E7C78',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C2520',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timer: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#1C2520',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 18,
    color: '#5C6B61',
    marginTop: 8,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201, 42, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#C92A2A',
    marginBottom: 20,
  },
  recordButtonActive: {
    backgroundColor: 'rgba(201, 42, 42, 0.2)',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C92A2A',
  },
  recordButtonStop: {
    borderRadius: 8,
    width: 40,
    height: 40,
  },
  hint: {
    fontSize: 16,
    color: '#5C6B61',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 30,
  },
  playButton: {
    backgroundColor: '#3E7C78',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  rerecordButton: {
    backgroundColor: '#5C6B61',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  rerecordButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#386641',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 16,
    marginTop: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#A0AAB2',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
    color: '#1C2520',
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

export default VoiceScreen;
