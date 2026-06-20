import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Tts from 'react-native-tts';
import { logMood, logWater, logMedication } from '../services/api';
import { MOOD_OPTIONS } from '../utils/constants';

const HealthScreen = ({ navigation }) => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [waterCount, setWaterCount] = useState(0);
  const [sending, setSending] = useState(false);

  const handleMoodSelect = async (mood) => {
    setSelectedMood(mood.value);
    setSending(true);
    try {
      await logMood(mood.value);
      Tts.speak(`Mood recorded as ${mood.label}`);
      Alert.alert('✅ Saved', `Mood: ${mood.label}`);
    } catch (error) {
      console.log('Mood error:', error.message);
      Alert.alert('Error', 'Failed to save mood');
    }
    setSending(false);
  };

  const addWater = async () => {
    setSending(true);
    try {
      const result = await logWater(1);
      setWaterCount(result.data.total || waterCount + 1);
      Tts.speak(`Water intake recorded. ${result.data.total || waterCount + 1} glasses today.`);
    } catch (error) {
      console.log('Water error:', error.message);
      setWaterCount((prev) => prev + 1);
      Tts.speak(`Water intake recorded. ${waterCount + 1} glasses today.`);
    }
    setSending(false);
  };

  const handleMedicationTaken = async (medName) => {
    setSending(true);
    try {
      await logMedication(medName);
      Tts.speak(`${medName} medication recorded.`);
      Alert.alert('✅ Saved', `${medName} recorded as taken`);
    } catch (error) {
      console.log('Medication error:', error.message);
      Alert.alert('Error', 'Failed to save medication');
    }
    setSending(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Health Check</Text>
      </View>

      {/* Mood Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How are you feeling?</Text>
        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map((mood) => (
            <TouchableOpacity
              key={mood.value}
              style={[
                styles.moodButton,
                selectedMood === mood.value && styles.moodButtonSelected,
              ]}
              onPress={() => handleMoodSelect(mood)}
              disabled={sending}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text
                style={[
                  styles.moodLabel,
                  selectedMood === mood.value && styles.moodLabelSelected,
                ]}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Water Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Water Intake</Text>
        <View style={styles.waterContainer}>
          <View style={styles.waterDisplay}>
            <Text style={styles.waterIcon}>💧</Text>
            <Text style={styles.waterCount}>{waterCount}</Text>
            <Text style={styles.waterLabel}>glasses today</Text>
          </View>
          <TouchableOpacity
            style={styles.waterButton}
            onPress={addWater}
            disabled={sending}
          >
            <Text style={styles.waterButtonText}>+ Add Glass</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Medications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medications</Text>
        <View style={styles.medicationList}>
          {['Morning Medicine', 'Blood Pressure', 'Vitamins', 'Evening Medicine'].map(
            (med) => (
              <TouchableOpacity
                key={med}
                style={styles.medicationItem}
                onPress={() => handleMedicationTaken(med)}
                disabled={sending}
              >
                <Text style={styles.medicationName}>{med}</Text>
                <View style={styles.medicationAction}>
                  <Text style={styles.medicationActionText}>Mark as Taken</Text>
                </View>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C2520',
    marginBottom: 16,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodButton: {
    width: '18%',
    aspectRatio: 1,
    backgroundColor: '#F7F6F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodButtonSelected: {
    borderColor: '#3E7C78',
    backgroundColor: '#E9F5EC',
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    fontSize: 11,
    color: '#5C6B61',
    marginTop: 4,
    textAlign: 'center',
  },
  moodLabelSelected: {
    color: '#3E7C78',
    fontWeight: '600',
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waterDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  waterCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3E7C78',
    marginRight: 8,
  },
  waterLabel: {
    fontSize: 16,
    color: '#5C6B61',
  },
  waterButton: {
    backgroundColor: '#457B9D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  waterButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  medicationList: {
    gap: 12,
  },
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F6F2',
    padding: 16,
    borderRadius: 12,
  },
  medicationName: {
    fontSize: 18,
    color: '#1C2520',
    flex: 1,
  },
  medicationAction: {
    backgroundColor: '#386641',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  medicationActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});

export default HealthScreen;
