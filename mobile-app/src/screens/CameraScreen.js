import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Tts from 'react-native-tts';
import { uploadPhoto, sendCheckin } from '../services/api';
import { getCurrentLocation } from '../services/locationService';

const CameraScreen = ({ navigation, route }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraType, setCameraType] = useState(RNCamera.Constants.Type.front);
  const cameraRef = useRef(null);
  const mode = route?.params?.mode || 'photo';

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'FamilyGuard Camera Permission',
            message: 'FamilyGuard needs camera access to take check-in photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
      }
    } else {
      setHasPermission(true);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.8, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        setPhoto(data);
        Tts.speak('Photo taken. Tap Send to share with family.');
      } catch (error) {
        console.log('Camera error:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
  };

  const flipCamera = () => {
    setCameraType(
      cameraType === RNCamera.Constants.Type.back
        ? RNCamera.Constants.Type.front
        : RNCamera.Constants.Type.back
    );
  };

  const sendPhoto = async () => {
    if (!photo) return;

    setUploading(true);
    try {
      const location = await getCurrentLocation();

      if (mode === 'checkin') {
        // Upload photo and send check-in
        const uploadResult = await uploadPhoto(photo.uri, location.latitude, location.longitude);
        await sendCheckin(location.latitude, location.longitude, uploadResult.data.file_url);
        Tts.speak('Check-in with photo sent to your family.');
        Alert.alert('✅ Sent', 'Your family has received your check-in with photo.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Just upload photo
        await uploadPhoto(photo.uri, location.latitude, location.longitude);
        Tts.speak('Photo sent to your family.');
        Alert.alert('✅ Sent', 'Photo has been sent to your family.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.log('Upload error:', error.message);
      Alert.alert('Error', 'Failed to send photo. Please try again.');
    }
    setUploading(false);
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Your Photo</Text>
        </View>
        <Image source={{ uri: photo.uri }} style={styles.preview} />
        <View style={styles.previewButtons}>
          <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
            <Text style={styles.retakeButtonText}>↺ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, uploading && styles.sendButtonDisabled]}
            onPress={sendPhoto}
            disabled={uploading}
          >
            <Text style={styles.sendButtonText}>
              {uploading ? 'Sending...' : '✓ Send to Family'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        captureAudio={false}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
            <Text style={styles.flipButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          <Text style={styles.hint}>Tap to take photo</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 24,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButtonText: {
    fontSize: 24,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  hint: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 16,
  },
  preview: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewHeader: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1C2520',
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  previewButtons: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#1C2520',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#5C6B61',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  sendButton: {
    flex: 2,
    backgroundColor: '#386641',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A0AAB2',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  permissionText: {
    color: '#FFF',
    fontSize: 18,
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

export default CameraScreen;
