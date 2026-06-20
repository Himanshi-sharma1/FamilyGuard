import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import Tts from 'react-native-tts';
import { sendCheckin, sendHeartbeat } from '../services/api';
import { getCurrentLocation } from '../services/locationService';
import SOSButton from '../components/SOSButton';
import DeviceInfo from 'react-native-device-info';

const HomeScreen = ({ navigation }) => {
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [battery, setBattery] = useState(100);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    updateGreeting();
    updateTime();
    updateBattery();

    const timeInterval = setInterval(updateTime, 1000);
    const batteryInterval = setInterval(updateBattery, 60000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(batteryInterval);
    };
  }, []);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  };

  const updateTime = () => {
    setCurrentTime(
      new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    );
  };

  const updateBattery = async () => {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      const isCharging = await DeviceInfo.isBatteryCharging();
      const batteryPercent = Math.round(level * 100);
      setBattery(batteryPercent);
      
      // Send heartbeat with battery info
      await sendHeartbeat(batteryPercent, isCharging);
    } catch (e) {
      console.log('Battery error:', e.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await updateBattery();
    setRefreshing(false);
  };

  const handleCheckIn = async () => {
    try {
      Tts.speak('Sending check-in to your family.');
      const location = await getCurrentLocation();
      await sendCheckin(location.latitude, location.longitude, null);
      Tts.speak('Check-in sent. Your family knows you are safe.');
      Alert.alert('✅ Sent', 'Your family has been notified that you are safe.');
    } catch (error) {
      console.log('Check-in error:', error.message);
      Alert.alert('Error', 'Failed to send check-in. Please try again.');
    }
  };

  const handlePhotoCheckIn = () => {
    navigation.navigate('Camera', { mode: 'checkin' });
  };

  const handleVoiceMessage = () => {
    navigation.navigate('Voice');
  };

  const handleHealthCheck = () => {
    navigation.navigate('Health');
  };

  const handleVideoCall = () => {
    navigation.navigate('VideoCall');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.time}>{currentTime}</Text>
      </View>

      {/* Live Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Family can see your location</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🔋 {battery}%</Text>
          <Text style={styles.statLabel}>Battery</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.actionButton, styles.greenButton]}
        onPress={handleCheckIn}
      >
        <Text style={styles.buttonEmoji}>✅</Text>
        <View style={styles.buttonTextContainer}>
          <Text style={styles.buttonTitle}>I Am Safe</Text>
          <Text style={styles.buttonSubtitle}>Tell family you're okay</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.blueButton]}
        onPress={handlePhotoCheckIn}
      >
        <Text style={styles.buttonEmoji}>📷</Text>
        <View style={styles.buttonTextContainer}>
          <Text style={styles.buttonTitle}>Take Photo</Text>
          <Text style={styles.buttonSubtitle}>Send selfie to family</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.purpleButton]}
        onPress={handleVoiceMessage}
      >
        <Text style={styles.buttonEmoji}>🎤</Text>
        <View style={styles.buttonTextContainer}>
          <Text style={styles.buttonTitle}>Voice Message</Text>
          <Text style={styles.buttonSubtitle}>Record and send</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.orangeButton]}
        onPress={handleHealthCheck}
      >
        <Text style={styles.buttonEmoji}>💊</Text>
        <View style={styles.buttonTextContainer}>
          <Text style={styles.buttonTitle}>Health Check</Text>
          <Text style={styles.buttonSubtitle}>Mood • Water • Meds</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.tealButton]}
        onPress={handleVideoCall}
      >
        <Text style={styles.buttonEmoji}>📞</Text>
        <View style={styles.buttonTextContainer}>
          <Text style={styles.buttonTitle}>Video Call</Text>
          <Text style={styles.buttonSubtitle}>Call family now</Text>
        </View>
      </TouchableOpacity>

      {/* SOS Button */}
      <View style={styles.sosSection}>
        <SOSButton />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1C2520',
  },
  time: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3E7C78',
    marginTop: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F5EC',
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginBottom: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#386641',
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#386641',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C2520',
  },
  statLabel: {
    fontSize: 14,
    color: '#5C6B61',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  greenButton: {
    backgroundColor: '#386641',
  },
  blueButton: {
    backgroundColor: '#457B9D',
  },
  purpleButton: {
    backgroundColor: '#7B68EE',
  },
  orangeButton: {
    backgroundColor: '#BC6C25',
  },
  tealButton: {
    backgroundColor: '#3E7C78',
  },
  buttonEmoji: {
    fontSize: 36,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  sosSection: {
    marginTop: 20,
  },
});

export default HomeScreen;
