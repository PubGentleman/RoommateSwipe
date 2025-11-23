import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';

export const EditProfileScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [budget, setBudget] = useState(user?.profileData?.budget?.toString() || '');
  const [location, setLocation] = useState(user?.profileData?.location || '');
  const [occupation, setOccupation] = useState(user?.profileData?.occupation || '');
  const [interests, setInterests] = useState(user?.profileData?.interests || '');
  
  const [sleepSchedule, setSleepSchedule] = useState<'early' | 'late' | 'flexible'>(user?.profileData?.preferences?.sleepSchedule || 'flexible');
  const [cleanliness, setCleanliness] = useState<'very_clean' | 'clean' | 'moderate'>(user?.profileData?.preferences?.cleanliness || 'clean');
  const [guestPolicy, setGuestPolicy] = useState<'frequent' | 'occasional' | 'rarely'>(user?.profileData?.preferences?.guestPolicy || 'occasional');
  const [petFriendly, setPetFriendly] = useState(user?.profileData?.preferences?.petFriendly || false);
  const [smoking, setSmoking] = useState(user?.profileData?.lifestyle?.smoking || false);
  const [drinking, setDrinking] = useState<'non-drinker' | 'social' | 'regular'>(user?.profileData?.lifestyle?.drinking || 'social');
  
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    await updateUser({
      name: name.trim(),
      email: email.trim(),
      profileData: {
        bio: bio.trim() || undefined,
        budget: budget.trim() ? parseInt(budget) : undefined,
        location: location.trim() || undefined,
        occupation: occupation.trim() || undefined,
        interests: interests.trim() || undefined,
        preferences: {
          sleepSchedule,
          cleanliness,
          guestPolicy,
          petFriendly,
        },
        lifestyle: {
          smoking,
          drinking,
        },
      },
    });

    setIsSaving(false);
    Alert.alert('Success', 'Profile updated successfully');
    navigation.goBack();
  };

  const OptionButton = ({ label, value, isSelected, onPress }: any) => (
    <Pressable
      style={[
        styles.optionButton,
        { 
          backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
          borderColor: isSelected ? theme.primary : theme.border,
        }
      ]}
      onPress={onPress}
    >
      <ThemedText style={[
        Typography.small,
        { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '600' : '400' }
      ]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const ToggleButton = ({ label, value, onPress, icon }: any) => (
    <Pressable
      style={[
        styles.toggleButton,
        { 
          backgroundColor: value ? theme.primary : theme.backgroundSecondary,
          borderColor: value ? theme.primary : theme.border,
        }
      ]}
      onPress={onPress}
    >
      <Feather name={icon} size={20} color={value ? '#FFFFFF' : theme.textSecondary} />
      <ThemedText style={[
        Typography.body,
        { color: value ? '#FFFFFF' : theme.text, marginLeft: Spacing.md, fontWeight: value ? '600' : '400' }
      ]}>
        {label}
      </ThemedText>
      <View style={{ marginLeft: 'auto' }}>
        <Feather name={value ? 'check-circle' : 'circle'} size={20} color={value ? '#FFFFFF' : theme.textSecondary} />
      </View>
    </Pressable>
  );

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.container}>
        <Pressable 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>

        <ThemedText style={[Typography.h1, { marginBottom: Spacing.md }]}>Edit Profile</ThemedText>

        <View style={[styles.infoCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <View style={styles.infoHeader}>
            <Feather name="info" size={20} color={theme.primary} />
            <ThemedText style={[Typography.body, { fontWeight: '600', marginLeft: Spacing.sm }]}>
              How Matching Works
            </ThemedText>
          </View>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            Your answers help us find your best roommate matches. Compatibility is scored out of 100 points:
          </ThemedText>
          
          <View style={styles.matchingFactors}>
            <View style={styles.factorRow}>
              <View style={[styles.pointBadge, { backgroundColor: theme.primary + '20' }]}>
                <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>15</ThemedText>
              </View>
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
                Sleep Schedule & Cleanliness
              </ThemedText>
            </View>
            <View style={styles.factorRow}>
              <View style={[styles.pointBadge, { backgroundColor: theme.primary + '20' }]}>
                <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>15</ThemedText>
              </View>
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
                Lifestyle (Smoking & Drinking)
              </ThemedText>
            </View>
            <View style={styles.factorRow}>
              <View style={[styles.pointBadge, { backgroundColor: theme.primary + '20' }]}>
                <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>15</ThemedText>
              </View>
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
                Budget Compatibility
              </ThemedText>
            </View>
            <View style={styles.factorRow}>
              <View style={[styles.pointBadge, { backgroundColor: theme.primary + '20' }]}>
                <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>10</ThemedText>
              </View>
              <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
                Guest Policy, Pets, Location & Occupation
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.colorGuide}>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: '#10B981' }]} />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>80%+ Excellent</ThemedText>
              <View style={[styles.colorDot, { backgroundColor: '#3B82F6', marginLeft: Spacing.md }]} />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>70-79% Great</ThemedText>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: '#F59E0B' }]} />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>60-69% Good</ThemedText>
              <View style={[styles.colorDot, { backgroundColor: '#EF4444', marginLeft: Spacing.md }]} />
              <ThemedText style={[Typography.caption, { marginLeft: Spacing.xs }]}>&lt;60% Fair</ThemedText>
            </View>
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Basic Information</ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Name *
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Email *
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="your.email@example.com"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Bio
            </ThemedText>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Tell others about yourself..."
              placeholderTextColor={theme.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Roommate Matching Info */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Roommate Preferences</ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
            This information helps us match you with compatible roommates
          </ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Monthly Budget
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., 1200"
              placeholderTextColor={theme.textSecondary}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Preferred Location
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., Downtown, Brooklyn"
              placeholderTextColor={theme.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Occupation
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., Software Engineer, Student"
              placeholderTextColor={theme.textSecondary}
              value={occupation}
              onChangeText={setOccupation}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Interests
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., Fitness, Cooking, Gaming"
              placeholderTextColor={theme.textSecondary}
              value={interests}
              onChangeText={setInterests}
            />
          </View>
        </View>

        {/* Lifestyle Preferences */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Lifestyle</ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Sleep Schedule
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton
                label="Early Bird"
                value="early"
                isSelected={sleepSchedule === 'early'}
                onPress={() => setSleepSchedule('early')}
              />
              <OptionButton
                label="Night Owl"
                value="late"
                isSelected={sleepSchedule === 'late'}
                onPress={() => setSleepSchedule('late')}
              />
              <OptionButton
                label="Flexible"
                value="flexible"
                isSelected={sleepSchedule === 'flexible'}
                onPress={() => setSleepSchedule('flexible')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Cleanliness Level
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton
                label="Very Clean"
                value="very_clean"
                isSelected={cleanliness === 'very_clean'}
                onPress={() => setCleanliness('very_clean')}
              />
              <OptionButton
                label="Clean"
                value="clean"
                isSelected={cleanliness === 'clean'}
                onPress={() => setCleanliness('clean')}
              />
              <OptionButton
                label="Moderate"
                value="moderate"
                isSelected={cleanliness === 'moderate'}
                onPress={() => setCleanliness('moderate')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Guest Policy
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton
                label="Frequent"
                value="frequent"
                isSelected={guestPolicy === 'frequent'}
                onPress={() => setGuestPolicy('frequent')}
              />
              <OptionButton
                label="Occasional"
                value="occasional"
                isSelected={guestPolicy === 'occasional'}
                onPress={() => setGuestPolicy('occasional')}
              />
              <OptionButton
                label="Rarely"
                value="rarely"
                isSelected={guestPolicy === 'rarely'}
                onPress={() => setGuestPolicy('rarely')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Drinking Habits
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton
                label="Non-drinker"
                value="non-drinker"
                isSelected={drinking === 'non-drinker'}
                onPress={() => setDrinking('non-drinker')}
              />
              <OptionButton
                label="Social"
                value="social"
                isSelected={drinking === 'social'}
                onPress={() => setDrinking('social')}
              />
              <OptionButton
                label="Regular"
                value="regular"
                isSelected={drinking === 'regular'}
                onPress={() => setDrinking('regular')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Preferences
            </ThemedText>
            <ToggleButton
              label="Pet Friendly"
              value={petFriendly}
              onPress={() => setPetFriendly(!petFriendly)}
              icon="heart"
            />
            <View style={{ height: Spacing.sm }} />
            <ToggleButton
              label="Smoker"
              value={smoking}
              onPress={() => setSmoking(!smoking)}
              icon="wind"
            />
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: theme.primary, opacity: isSaving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  matchingFactors: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointBadge: {
    width: 32,
    height: 24,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGuide: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    gap: Spacing.xs,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  saveButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
});
