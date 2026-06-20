import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Alert } from 'react-native';
import Tts from 'react-native-tts';
import { triggerSOS } from '../services/api';
import { getCurrentLocation } from '../services/locationService';
import { SOS_HOLD_DURATION } from '../utils/constants';

const SOSButton = ({ onSOSTriggered }) => {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef(null);
  const progressTimer = useRef(null);

  const handlePressIn = () => {
    setPressing(true);
    setProgress(0);
    Vibration.vibrate(100);

    progressTimer.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(progressTimer.current);
          handleSOSTrigger();
          return 100;
        }
        return next;
      });
    }, SOS_HOLD_DURATION / 20);
  };

  const handlePressOut = () => {
    setPressing(false);
    setProgress(0);
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
    }
  };

  const handleSOSTrigger = async () => {
    Vibration.vibrate([500, 200, 500, 200, 500]);
    
    try {
      Tts.speak('Emergency alert being sent to your family.');
    } catch (e) {}

    try {
      const location = await getCurrentLocation();
      await triggerSOS(location.latitude, location.longitude, null, null);
      
      Alert.alert(
        '🚨 SOS Sent',
        'Emergency alert has been sent to your family with your location.',
        [{ text: 'OK' }]
      );

      if (onSOSTriggered) {
        onSOSTriggered();
      }
    } catch (error) {
      console.log('[SOS] Error:', error.message);
      Alert.alert('Error', 'Failed to send SOS. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, pressing && styles.buttonPressed]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.progressBar, { width: progress + '%' }]} />
        <View style={styles.content}>
          <Text style={styles.emoji}>🚨</Text>
          <Text style={styles.text}>HOLD FOR EMERGENCY</Text>
          <Text style={styles.hint}>
            {pressing ? Math.ceil((progress / 100) * 2) + 's' : 'Hold 2 seconds'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#C92A2A',
    borderRadius: 20,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    elevation: 5,
    shadowColor: '#C92A2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonPressed: {
    backgroundColor: '#A61E1E',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
});

export default SOSButton;
