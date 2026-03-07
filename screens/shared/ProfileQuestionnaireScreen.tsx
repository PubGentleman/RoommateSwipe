import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { calculateZodiacFromBirthday } from '../../utils/zodiacUtils';
import { ProgressBar } from '../../components/questionnaire/ProgressBar';
import { SelectionCard } from '../../components/questionnaire/SelectionCard';
import { LocationPicker } from '../../components/LocationPicker';
import { getCoordinatesFromNeighborhood } from '../../utils/locationData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 13;

type StepId =
  | 'photos'
  | 'basicInfo'
  | 'gender'
  | 'locationOccupation'
  | 'bio'
  | 'sleepSchedule'
  | 'cleanliness'
  | 'smoking'
  | 'social'
  | 'workPets'
  | 'housing'
  | 'lifestyle'
  | 'expenses';

const STEP_ORDER: StepId[] = [
  'photos',
  'basicInfo',
  'gender',
  'locationOccupation',
  'bio',
  'sleepSchedule',
  'cleanliness',
  'smoking',
  'social',
  'workPets',
  'housing',
  'lifestyle',
  'expenses',
];

const STEP_TITLES: Record<StepId, string> = {
  photos: 'Add Your Photos',
  basicInfo: 'About You',
  gender: 'Your Gender',
  locationOccupation: 'Location & Work',
  bio: 'Write Your Bio',
  sleepSchedule: 'Sleep Schedule',
  cleanliness: 'Cleanliness Style',
  smoking: 'Smoking Preferences',
  social: 'Social Preferences',
  workPets: 'Work & Pets',
  housing: 'Housing Preferences',
  lifestyle: 'Your Lifestyle',
  expenses: 'Shared Expenses',
};

const STEP_SUBTITLES: Record<StepId, string> = {
  photos: 'Add up to 6 photos. Your first photo is your main profile picture.',
  basicInfo: 'Let others know who you are.',
  gender: 'How do you identify?',
  locationOccupation: 'Where are you looking and what do you do?',
  bio: 'Tell potential roommates about yourself.',
  sleepSchedule: 'When do you usually sleep and wake up?',
  cleanliness: 'How tidy do you keep your space?',
  smoking: 'What are your preferences on smoking?',
  social: 'How do you feel about guests and noise?',
  workPets: 'Where do you work and how do you feel about pets?',
  housing: 'What are your housing needs?',
  lifestyle: 'Pick up to 3 that describe you best.',
  expenses: 'How would you like to split shared costs?',
};

export const ProfileQuestionnaireScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const initialStepParam = (route.params as any)?.initialStep;
  const initialStepIndex = initialStepParam ? STEP_ORDER.indexOf(initialStepParam as StepId) : -1;
  const isSingleStepMode = initialStepIndex >= 0;
  const [currentStep, setCurrentStep] = useState(initialStepIndex >= 0 ? initialStepIndex : 0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isSaving, setIsSaving] = useState(false);

  const [photos, setPhotos] = useState<string[]>(user?.photos || (user?.profilePicture ? [user.profilePicture] : []));
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [birthday, setBirthday] = useState(() => {
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
      }
      return user.birthday.replace(/-/g, '/');
    }
    return '';
  });
  const [birthdayError, setBirthdayError] = useState('');
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [budget, setBudget] = useState(user?.profileData?.budget?.toString() || '');
  const [lookingFor, setLookingFor] = useState<'room' | 'entire_apartment'>(user?.profileData?.lookingFor || 'room');
  const [location, setLocation] = useState(user?.profileData?.location || '');
  const [selectedState, setSelectedState] = useState(user?.profileData?.state || '');
  const [selectedCity, setSelectedCity] = useState(user?.profileData?.city || '');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(user?.profileData?.neighborhood || '');
  const [occupation, setOccupation] = useState(user?.profileData?.occupation || '');
  const [interests, setInterests] = useState(user?.profileData?.interests || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>(user?.profileData?.gender);
  const [sleepSchedule, setSleepSchedule] = useState<'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular'>(user?.profileData?.preferences?.sleepSchedule || 'flexible');
  const [cleanliness, setCleanliness] = useState<'very_tidy' | 'moderately_tidy' | 'relaxed'>(user?.profileData?.preferences?.cleanliness || 'moderately_tidy');
  const [guestPolicy, setGuestPolicy] = useState<'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests'>(user?.profileData?.preferences?.guestPolicy || 'occasionally');
  const [noiseTolerance, setNoiseTolerance] = useState<'prefer_quiet' | 'normal_noise' | 'loud_environments'>(user?.profileData?.preferences?.noiseTolerance || 'normal_noise');
  const [smoking, setSmoking] = useState<'yes' | 'no' | 'only_outside'>(user?.profileData?.preferences?.smoking || 'no');
  const [workLocation, setWorkLocation] = useState<'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular'>(user?.profileData?.preferences?.workLocation || 'hybrid');
  const [roommateRelationship, setRoommateRelationship] = useState<'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction'>(user?.profileData?.preferences?.roommateRelationship || 'respectful_coliving');
  const [pets, setPets] = useState<'have_pets' | 'open_to_pets' | 'no_pets'>(user?.profileData?.preferences?.pets || 'open_to_pets');
  const [lifestyle, setLifestyle] = useState<Array<'active_gym' | 'homebody' | 'nightlife_social' | 'quiet_introverted' | 'creative_artistic' | 'professional_focused'>>(user?.profileData?.preferences?.lifestyle || []);
  const [expenseUtilities, setExpenseUtilities] = useState<'split_equally' | 'usage_based' | 'included_in_rent'>(user?.profileData?.preferences?.sharedExpenses?.utilities || 'split_equally');
  const [expenseGroceries, setExpenseGroceries] = useState<'split_equally' | 'buy_own' | 'shared_basics'>(user?.profileData?.preferences?.sharedExpenses?.groceries || 'buy_own');
  const [expenseInternet, setExpenseInternet] = useState<'split_equally' | 'one_pays' | 'included_in_rent'>(user?.profileData?.preferences?.sharedExpenses?.internet || 'split_equally');
  const [expenseCleaning, setExpenseCleaning] = useState<'split_equally' | 'take_turns' | 'hire_cleaner'>(user?.profileData?.preferences?.sharedExpenses?.cleaning || 'split_equally');
  const [moveInDate, setMoveInDate] = useState(() => {
    const raw = user?.profileData?.preferences?.moveInDate || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${m}/${d}/${y}`;
    }
    return raw;
  });
  const [bedrooms, setBedrooms] = useState(user?.profileData?.preferences?.bedrooms?.toString() || '');

  useEffect(() => {
    if (user?.photos && user.photos.length > 0) {
      setPhotos(user.photos);
    } else if (user?.profilePicture) {
      setPhotos([user.profilePicture]);
    }
  }, [user?.photos, user?.profilePicture]);

  const validateBirthday = (dateString: string): { valid: boolean; error: string } => {
    if (!dateString.trim()) return { valid: false, error: 'Please enter your date of birth' };
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dateRegex.test(dateString)) return { valid: false, error: 'Invalid format. Use MM/DD/YYYY' };
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { valid: false, error: 'Invalid date' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return { valid: false, error: 'Date cannot be in the future' };
    const age = Math.floor((today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) return { valid: false, error: 'You must be at least 18 years old' };
    return { valid: true, error: '' };
  };

  const convertToStorageFormat = (dateString: string): string => {
    const [month, day, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const pickImage = async () => {
    if (photos.length >= 6) {
      Alert.alert('Maximum Reached', 'You can upload up to 6 photos');
      return;
    }
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            Alert.alert('File Too Large', 'Please select an image smaller than 10MB');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageUrl = event.target?.result as string;
            if (imageUrl) setPhotos(prev => [...prev, imageUrl]);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Photo library access is required to add photos.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const toggleLifestyle = (item: typeof lifestyle[number]) => {
    if (lifestyle.includes(item)) {
      setLifestyle(lifestyle.filter(l => l !== item));
    } else if (lifestyle.length < 3) {
      setLifestyle([...lifestyle, item]);
    } else {
      Alert.alert('Maximum Reached', 'You can select up to 3 lifestyle choices');
    }
  };

  const validateCurrentStep = (): boolean => {
    const stepId = STEP_ORDER[currentStep];
    switch (stepId) {
      case 'basicInfo':
        if (!name.trim()) { Alert.alert('Required', 'Please enter your name'); return false; }
        if (!email.trim()) { Alert.alert('Required', 'Please enter your email'); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { Alert.alert('Error', 'Please enter a valid email'); return false; }
        if (birthday.trim()) {
          const v = validateBirthday(birthday);
          if (!v.valid) { setBirthdayError(v.error); Alert.alert('Error', v.error); return false; }
        }
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection('forward');
      setCurrentStep(currentStep + 1);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  const goBack = () => {
    if (isSingleStepMode) {
      navigation.goBack();
    } else if (currentStep > 0) {
      setDirection('back');
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    const birthdayStorageFormat = birthday.trim() ? convertToStorageFormat(birthday) : user?.birthday;
    const zodiacSign = birthdayStorageFormat ? calculateZodiacFromBirthday(birthdayStorageFormat) : undefined;

    await updateUser({
      name: name.trim(),
      email: email.trim(),
      birthday: birthdayStorageFormat,
      zodiacSign,
      photos,
      profilePicture: photos[0] || undefined,
      profileData: {
        bio: bio.trim() || undefined,
        budget: budget.trim() ? parseInt(budget) : undefined,
        lookingFor,
        location: selectedNeighborhood || selectedCity || location.trim() || undefined,
        neighborhood: selectedNeighborhood || undefined,
        city: selectedCity || undefined,
        state: selectedState || undefined,
        coordinates: selectedNeighborhood ? getCoordinatesFromNeighborhood(selectedNeighborhood) || undefined : undefined,
        occupation: occupation.trim() || undefined,
        interests: interests.trim() || undefined,
        gender,
        preferences: {
          sleepSchedule,
          cleanliness,
          guestPolicy,
          noiseTolerance,
          smoking,
          workLocation,
          roommateRelationship,
          pets,
          lifestyle,
          moveInDate: moveInDate.trim() || undefined,
          bedrooms: bedrooms.trim() ? parseInt(bedrooms) : undefined,
          sharedExpenses: {
            utilities: expenseUtilities,
            groceries: expenseGroceries,
            internet: expenseInternet,
            cleaning: expenseCleaning,
          },
        },
      },
    });

    setIsSaving(false);
    Alert.alert('Success', 'Profile updated successfully');
    navigation.goBack();
  };

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  const renderStepContent = () => {
    const stepId = STEP_ORDER[currentStep];

    switch (stepId) {
      case 'photos':
        return (
          <View style={styles.stepInner}>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={`photo-${index}`} style={[styles.photoSlot, { borderColor: theme.border }]}>
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                  {index === 0 ? (
                    <View style={[styles.mainBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>Main</ThemedText>
                    </View>
                  ) : null}
                  <Pressable
                    style={[styles.removeBtn, { backgroundColor: theme.error }]}
                    onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 6 ? (
                <Pressable
                  style={[styles.photoSlot, styles.addPhotoSlot, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                  onPress={pickImage}
                >
                  <Feather name="plus" size={28} color={theme.textSecondary} />
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>Add</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        );

      case 'basicInfo':
        return (
          <View style={styles.stepInner}>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Name *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Email *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Date of Birth *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: birthdayError ? theme.error : theme.border, color: theme.text }]}
                value={birthday}
                onChangeText={(text) => { setBirthday(text); setBirthdayError(''); }}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
              />
              {birthdayError ? (
                <ThemedText style={[Typography.small, { color: theme.error, marginTop: Spacing.xs }]}>{birthdayError}</ThemedText>
              ) : null}
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Interests</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={interests}
                onChangeText={setInterests}
                placeholder="Fitness, Cooking, Music..."
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        );

      case 'gender':
        return (
          <View style={styles.stepInner}>
            <SelectionCard icon="user" title="Male" isSelected={gender === 'male'} onPress={() => setGender('male')} index={0} />
            <SelectionCard icon="user" title="Female" isSelected={gender === 'female'} onPress={() => setGender('female')} index={1} />
            <SelectionCard icon="users" title="Other" isSelected={gender === 'other'} onPress={() => setGender('other')} index={2} />
          </View>
        );

      case 'locationOccupation':
        return (
          <View style={styles.stepInner}>
            <LocationPicker
              selectedState={selectedState}
              selectedCity={selectedCity}
              selectedNeighborhood={selectedNeighborhood}
              onStateChange={setSelectedState}
              onCityChange={setSelectedCity}
              onNeighborhoodChange={setSelectedNeighborhood}
            />
            <View style={[styles.inputGroup, { marginTop: Spacing.lg }]}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Occupation</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="Software Engineer"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        );

      case 'bio':
        return (
          <View style={styles.stepInner}>
            <TextInput
              style={[styles.textInput, styles.bioInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell potential roommates about yourself, your hobbies, and what you're looking for..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'right', marginTop: Spacing.xs }]}>
              {bio.length}/500
            </ThemedText>
          </View>
        );

      case 'sleepSchedule':
        return (
          <View style={styles.stepInner}>
            <SelectionCard icon="sunrise" title="Early Sleeper / Early Riser" subtitle="In bed by 10pm, up by 7am" isSelected={sleepSchedule === 'early_sleeper'} onPress={() => setSleepSchedule('early_sleeper')} index={0} />
            <SelectionCard icon="moon" title="Late Sleeper / Late Riser" subtitle="Night owl, sleep in late" isSelected={sleepSchedule === 'late_sleeper'} onPress={() => setSleepSchedule('late_sleeper')} index={1} />
            <SelectionCard icon="clock" title="Flexible" subtitle="Adapts to any schedule" isSelected={sleepSchedule === 'flexible'} onPress={() => setSleepSchedule('flexible')} index={2} />
            <SelectionCard icon="shuffle" title="Irregular" subtitle="Shift work or unpredictable hours" isSelected={sleepSchedule === 'irregular'} onPress={() => setSleepSchedule('irregular')} index={3} />
          </View>
        );

      case 'cleanliness':
        return (
          <View style={styles.stepInner}>
            <SelectionCard icon="check-circle" title="Very Tidy" subtitle="Everything in its place" isSelected={cleanliness === 'very_tidy'} onPress={() => setCleanliness('very_tidy')} index={0} />
            <SelectionCard icon="check" title="Moderately Tidy" subtitle="Clean but not obsessive" isSelected={cleanliness === 'moderately_tidy'} onPress={() => setCleanliness('moderately_tidy')} index={1} />
            <SelectionCard icon="coffee" title="Relaxed About Clutter" subtitle="Comfortable with a lived-in look" isSelected={cleanliness === 'relaxed'} onPress={() => setCleanliness('relaxed')} index={2} />
          </View>
        );

      case 'smoking':
        return (
          <View style={styles.stepInner}>
            <SelectionCard icon="check-circle" title="Yes" subtitle="I smoke indoors" isSelected={smoking === 'yes'} onPress={() => setSmoking('yes')} index={0} />
            <SelectionCard icon="x-circle" title="No" subtitle="I don't smoke" isSelected={smoking === 'no'} onPress={() => setSmoking('no')} index={1} />
            <SelectionCard icon="wind" title="Only Outside" subtitle="I smoke but only outdoors" isSelected={smoking === 'only_outside'} onPress={() => setSmoking('only_outside')} index={2} />
          </View>
        );

      case 'social':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.text }]}>Guest Policy</ThemedText>
            <SelectionCard icon="user-x" title="Rarely" isSelected={guestPolicy === 'rarely'} onPress={() => setGuestPolicy('rarely')} index={0} />
            <SelectionCard icon="user-check" title="Occasionally" isSelected={guestPolicy === 'occasionally'} onPress={() => setGuestPolicy('occasionally')} index={1} />
            <SelectionCard icon="users" title="Frequently" isSelected={guestPolicy === 'frequently'} onPress={() => setGuestPolicy('frequently')} index={2} />
            <SelectionCard icon="x" title="Prefer No Guests" isSelected={guestPolicy === 'prefer_no_guests'} onPress={() => setGuestPolicy('prefer_no_guests')} index={3} />

            <View style={{ height: Spacing.xl }} />

            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.text }]}>Noise Tolerance</ThemedText>
            <SelectionCard icon="volume-x" title="Prefer Quiet" isSelected={noiseTolerance === 'prefer_quiet'} onPress={() => setNoiseTolerance('prefer_quiet')} index={0} />
            <SelectionCard icon="volume-1" title="Normal Noise is Fine" isSelected={noiseTolerance === 'normal_noise'} onPress={() => setNoiseTolerance('normal_noise')} index={1} />
            <SelectionCard icon="volume-2" title="Loud is OK" isSelected={noiseTolerance === 'loud_environments'} onPress={() => setNoiseTolerance('loud_environments')} index={2} />
          </View>
        );

      case 'workPets':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.text }]}>Work Location</ThemedText>
            <SelectionCard icon="home" title="Work From Home" subtitle="Full-time remote" isSelected={workLocation === 'wfh_fulltime'} onPress={() => setWorkLocation('wfh_fulltime')} index={0} />
            <SelectionCard icon="repeat" title="Hybrid" subtitle="Mix of home and office" isSelected={workLocation === 'hybrid'} onPress={() => setWorkLocation('hybrid')} index={1} />
            <SelectionCard icon="briefcase" title="Office Full-time" subtitle="Out of the house all day" isSelected={workLocation === 'office_fulltime'} onPress={() => setWorkLocation('office_fulltime')} index={2} />
            <SelectionCard icon="shuffle" title="Irregular Schedule" isSelected={workLocation === 'irregular'} onPress={() => setWorkLocation('irregular')} index={3} />

            <View style={{ height: Spacing.xl }} />

            <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.text }]}>Pets</ThemedText>
            <SelectionCard icon="heart" title="I Have Pets" isSelected={pets === 'have_pets'} onPress={() => setPets('have_pets')} index={0} />
            <SelectionCard icon="smile" title="Open to Pets" isSelected={pets === 'open_to_pets'} onPress={() => setPets('open_to_pets')} index={1} />
            <SelectionCard icon="x-circle" title="Prefer No Pets" subtitle="Allergies or personal preference" isSelected={pets === 'no_pets'} onPress={() => setPets('no_pets')} index={2} />
          </View>
        );

      case 'housing':
        return (
          <View style={styles.stepInner}>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Monthly Budget ($)</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={budget}
                onChangeText={setBudget}
                placeholder="1500"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
            </View>

            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.md }]}>Looking For</ThemedText>
            <SelectionCard icon="grid" title="A Room" subtitle="Shared apartment" isSelected={lookingFor === 'room'} onPress={() => setLookingFor('room')} index={0} />
            <SelectionCard icon="home" title="Entire Apartment" subtitle="Full place for you and roommates" isSelected={lookingFor === 'entire_apartment'} onPress={() => setLookingFor('entire_apartment')} index={1} />

            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }]}>Move-in Date</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={moveInDate}
                onChangeText={setMoveInDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>Bedrooms</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                value={bedrooms}
                onChangeText={setBedrooms}
                placeholder="2"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        );

      case 'lifestyle':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
              {lifestyle.length}/3 selected
            </ThemedText>
            <SelectionCard icon="activity" title="Very Active / Gym" isSelected={lifestyle.includes('active_gym')} onPress={() => toggleLifestyle('active_gym')} index={0} multiSelect />
            <SelectionCard icon="home" title="Homebody" isSelected={lifestyle.includes('homebody')} onPress={() => toggleLifestyle('homebody')} index={1} multiSelect />
            <SelectionCard icon="music" title="Nightlife / Social" isSelected={lifestyle.includes('nightlife_social')} onPress={() => toggleLifestyle('nightlife_social')} index={2} multiSelect />
            <SelectionCard icon="book" title="Quiet / Introverted" isSelected={lifestyle.includes('quiet_introverted')} onPress={() => toggleLifestyle('quiet_introverted')} index={3} multiSelect />
            <SelectionCard icon="edit-3" title="Creative / Artistic" isSelected={lifestyle.includes('creative_artistic')} onPress={() => toggleLifestyle('creative_artistic')} index={4} multiSelect />
            <SelectionCard icon="trending-up" title="Professional-focused" isSelected={lifestyle.includes('professional_focused')} onPress={() => toggleLifestyle('professional_focused')} index={5} multiSelect />
          </View>
        );

      case 'expenses':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm, color: theme.text }]}>Utilities</ThemedText>
            <SelectionCard icon="zap" title="Split Equally" isSelected={expenseUtilities === 'split_equally'} onPress={() => setExpenseUtilities('split_equally')} index={0} />
            <SelectionCard icon="bar-chart" title="Based on Usage" isSelected={expenseUtilities === 'usage_based'} onPress={() => setExpenseUtilities('usage_based')} index={1} />
            <SelectionCard icon="home" title="Included in Rent" isSelected={expenseUtilities === 'included_in_rent'} onPress={() => setExpenseUtilities('included_in_rent')} index={2} />

            <View style={{ height: Spacing.lg }} />
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm, color: theme.text }]}>Groceries</ThemedText>
            <SelectionCard icon="shopping-cart" title="Split Equally" isSelected={expenseGroceries === 'split_equally'} onPress={() => setExpenseGroceries('split_equally')} index={0} />
            <SelectionCard icon="shopping-bag" title="Everyone Buys Their Own" isSelected={expenseGroceries === 'buy_own'} onPress={() => setExpenseGroceries('buy_own')} index={1} />
            <SelectionCard icon="share-2" title="Share Basics" isSelected={expenseGroceries === 'shared_basics'} onPress={() => setExpenseGroceries('shared_basics')} index={2} />

            <View style={{ height: Spacing.lg }} />
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm, color: theme.text }]}>Internet / WiFi</ThemedText>
            <SelectionCard icon="wifi" title="Split Equally" isSelected={expenseInternet === 'split_equally'} onPress={() => setExpenseInternet('split_equally')} index={0} />
            <SelectionCard icon="user" title="One Person Pays" isSelected={expenseInternet === 'one_pays'} onPress={() => setExpenseInternet('one_pays')} index={1} />
            <SelectionCard icon="home" title="Included in Rent" isSelected={expenseInternet === 'included_in_rent'} onPress={() => setExpenseInternet('included_in_rent')} index={2} />

            <View style={{ height: Spacing.lg }} />
            <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm, color: theme.text }]}>Cleaning Supplies</ThemedText>
            <SelectionCard icon="droplet" title="Split Equally" isSelected={expenseCleaning === 'split_equally'} onPress={() => setExpenseCleaning('split_equally')} index={0} />
            <SelectionCard icon="refresh-cw" title="Take Turns Buying" isSelected={expenseCleaning === 'take_turns'} onPress={() => setExpenseCleaning('take_turns')} index={1} />
            <SelectionCard icon="award" title="Hire a Cleaner" isSelected={expenseCleaning === 'hire_cleaner'} onPress={() => setExpenseCleaning('hire_cleaner')} index={2} />
          </View>
        );

      default:
        return null;
    }
  };

  const currentStepId = STEP_ORDER[currentStep];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.navHeader}>
          <Pressable onPress={goBack} style={styles.navButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>
            {currentStep === 0 ? 'Edit Profile' : ''}
          </ThemedText>
          <View style={styles.navButton} />
        </View>
        <ProgressBar currentStep={isSingleStepMode ? 0 : currentStep} totalSteps={isSingleStepMode ? 1 : TOTAL_STEPS} />
      </View>

      <ScrollView
        key={currentStepId}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={currentStepId}
          entering={direction === 'forward' ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
        >
          <ThemedText style={[Typography.h2, { marginBottom: Spacing.xs }]}>
            {STEP_TITLES[currentStepId]}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
            {STEP_SUBTITLES[currentStepId]}
          </ThemedText>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + 80 }]}>
        {isLastStep || isSingleStepMode ? (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>{isSingleStepMode ? 'Save' : 'Save Profile'}</ThemedText>
                <Feather name="check" size={20} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        ) : (
          <Pressable style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={goNext}>
            <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>Next</ThemedText>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  navButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  stepInner: {
    paddingBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  textInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
  },
  bioInput: {
    height: 150,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 0.8,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addPhotoSlot: {
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.large,
    gap: Spacing.sm,
  },
});
