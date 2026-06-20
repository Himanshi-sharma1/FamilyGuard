import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { registerDevice } from '../services/api';

const { height } = Dimensions.get('window');

const features = [
  {
    icon: '📍',
    title: 'Location Tracking',
    desc: 'Your exact location sent to family every 30 seconds. You can see it on your phone and family can see it on their dashboard.',
  },
  {
    icon: '📷',
    title: 'Camera Access',
    desc: 'You control the camera. When you tap "I Am Safe" button, you can take a selfie. In emergencies, we ask permission first.',
  },
  {
    icon: '🎤',
    title: 'Microphone Access',
    desc: 'You can record voice messages to send to family. The app can speak alerts aloud to you.',
  },
  {
    icon: '📊',
    title: 'Activity Monitoring',
    desc: 'We detect if you fall down and alert your family. We also track your daily steps.',
  },
  {
    icon: '🚨',
    title: 'Emergency Button',
    desc: 'You control the SOS button. Hold it for 2 seconds to send emergency alert with your location.',
  },
  {
    icon: '📞',
    title: 'Video Calls',
    desc: 'Family can video call you directly through this app. Answer calls with one tap.',
  },
  {
    icon: '💊',
    title: 'Health Tracking',
    desc: 'Track your mood, water intake, and medication. Family can see how you are doing.',
  },
];

const ConsentScreen = ({ onConsentGiven }) => {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isAtBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      await registerDevice(deviceId, 'Father');
      await AsyncStorage.setItem('consent_given', 'true');
      await AsyncStorage.setItem('consent_timestamp', new Date().toISOString());
      await AsyncStorage.setItem('device_id', deviceId);
      onConsentGiven();
    } catch (error) {
      console.log('Registration error:', error.message);
      // Still proceed even if registration fails - will retry later
      await AsyncStorage.setItem('consent_given', 'true');
      onConsentGiven();
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>FamilyGuard</Text>
          <Text style={styles.subtitle}>Family Safety with Your Consent</Text>
        </View>

        <Text style={styles.sectionTitle}>What This App Does:</Text>

        {features.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{feature.icon}</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}

        <View style={styles.confirmSection}>
          <Text style={styles.confirmText}>
            I understand everything above and agree to use FamilyGuard to keep me safe and connected with my family.
          </Text>
        </View>

        <View style={styles.scrollHint}>
          {!scrolledToBottom && (
            <Text style={styles.scrollHintText}>↓ Scroll down to continue ↓</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.agreeButton,
            !scrolledToBottom && styles.agreeButtonDisabled,
          ]}
          onPress={handleAccept}
          disabled={!scrolledToBottom || loading}
        >
          <Text style={styles.agreeButtonText}>
            {loading ? 'Setting up...' : 'I Understand and Agree'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3E7C78',
  },
  subtitle: {
    fontSize: 18,
    color: '#5C6B61',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C2520',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C2520',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 15,
    color: '#5C6B61',
    lineHeight: 22,
  },
  confirmSection: {
    backgroundColor: '#E9F5EC',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A3B18A',
  },
  confirmText: {
    fontSize: 16,
    color: '#386641',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollHint: {
    alignItems: 'center',
    paddingVertical: 30,
    minHeight: 60,
  },
  scrollHintText: {
    fontSize: 14,
    color: '#5C6B61',
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E0D8',
  },
  agreeButton: {
    backgroundColor: '#3E7C78',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  agreeButtonDisabled: {
    backgroundColor: '#A0AAB2',
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default ConsentScreen;
