import React, { useState, useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import Tts from 'react-native-tts';

// Screens
import ConsentScreen from './src/screens/ConsentScreen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import VoiceScreen from './src/screens/VoiceScreen';
import HealthScreen from './src/screens/HealthScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';

// Services
import { startLocationTracking } from './src/services/locationService';
import { startFallDetection, setFallCallback } from './src/services/fallDetection';
import { connectSocket } from './src/services/socket';
import { registerDevice } from './src/services/api';

// Ignore some warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes',
]);

const Stack = createNativeStackNavigator();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize TTS
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(0.45);
      Tts.setDefaultPitch(1.0);

      // Check if consent was already given
      const consent = await AsyncStorage.getItem('consent_given');
      if (consent === 'true') {
        setHasConsent(true);
        await startServices();
      }
    } catch (error) {
      console.log('Init error:', error);
    }
    setIsLoading(false);
  };

  const startServices = async () => {
    try {
      // Get or register device
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = await DeviceInfo.getUniqueId();
        await AsyncStorage.setItem('device_id', deviceId);
      }

      // Try to register device (will get token if not already registered)
      const deviceToken = await AsyncStorage.getItem('device_token');
      if (!deviceToken) {
        try {
          await registerDevice(deviceId, 'Father');
        } catch (e) {
          console.log('Device registration failed, will retry later');
        }
      }

      // Connect socket
      connectSocket(deviceId);

      // Start location tracking
      await startLocationTracking();

      // Start fall detection
      startFallDetection();
      setFallCallback(() => {
        // Navigate to alert screen or show modal
        console.log('[App] Fall detected callback');
      });

      console.log('[App] All services started');
    } catch (error) {
      console.log('[App] Service start error:', error);
    }
  };

  const handleConsentGiven = async () => {
    setHasConsent(true);
    await startServices();
  };

  if (isLoading) {
    return null; // Or splash screen
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F6F2" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {!hasConsent ? (
            <Stack.Screen name="Consent">
              {(props) => <ConsentScreen {...props} onConsentGiven={handleConsentGiven} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Camera" component={CameraScreen} />
              <Stack.Screen name="Voice" component={VoiceScreen} />
              <Stack.Screen name="Health" component={HealthScreen} />
              <Stack.Screen name="VideoCall" component={VideoCallScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;
