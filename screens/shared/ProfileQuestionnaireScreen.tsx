import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Text,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { DatePickerModal } from '../../components/DatePickerModal';
import { formatDate, isAtLeast18, getTierLimit } from '../../utils/dateUtils';
import { OccupationBarSelector } from '../../components/OccupationBarSelector';
import { InterestCategoryBars } from '../../components/InterestCategoryBars';
import { INTEREST_TAGS, MIN_TAGS } from '../../constants/interestTags';
import { validateInterestTags } from '../../utils/profileReminderUtils';
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
import { useConfirm } from '../../contexts/ConfirmContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { calculateZodiacFromBirthday } from '../../utils/zodiacUtils';
import { ProgressBar } from '../../components/questionnaire/ProgressBar';
import { SelectionCard } from '../../components/questionnaire/SelectionCard';
import { LocationPicker } from '../../components/LocationPicker';
import { getCoordinatesFromNeighborhood } from '../../utils/locationData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 15;

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
  | 'noiseTolerance'
  | 'workPets'
  | 'housing'
  | 'interests'
  | 'expenses'
  | 'personality';

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
  'noiseTolerance',
  'workPets',
  'housing',
  'interests',
  'expenses',
  'personality',
];

const ONBOARDING_STEPS: StepId[] = [
  'photos',
  'basicInfo',
  'gender',
  'locationOccupation',
  'bio',
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
  noiseTolerance: 'Noise Tolerance',
  workPets: 'Work & Pets',
  housing: 'Housing Preferences',
  interests: 'Interests & Lifestyle',
  expenses: 'Shared Expenses',
  personality: 'One Last Thing',
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
  social: 'How do you feel about guests?',
  noiseTolerance: 'How much noise can you handle?',
  workPets: 'Where do you work and how do you feel about pets?',
  housing: 'What are your housing needs?',
  interests: 'Pick at least 1 tag from each category. This helps us find your perfect roommate.',
  expenses: 'How would you like to split shared costs?',
  personality: '5 quick questions to find your best matches',
};

const STEP_ICONS: Record<StepId, keyof typeof Feather.glyphMap> = {
  photos: 'camera',
  basicInfo: 'user',
  gender: 'credit-card',
  locationOccupation: 'map-pin',
  bio: 'edit-3',
  sleepSchedule: 'moon',
  cleanliness: 'trash-2',
  smoking: 'wind',
  social: 'users',
  noiseTolerance: 'volume-2',
  workPets: 'briefcase',
  housing: 'home',
  interests: 'star',
  expenses: 'dollar-sign',
  personality: 'cpu',
};

export const ProfileQuestionnaireScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep, logout, abandonSignup } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const isOnboarding = user?.onboardingStep === 'profile';
  const missingStepsParam = (route.params as any)?.missingSteps as string[] | undefined;
  const filteredSteps = React.useMemo(() => {
    if (missingStepsParam?.length) {
      return missingStepsParam.filter(s => STEP_ORDER.includes(s as StepId)) as StepId[];
    }
    return null;
  }, []);
  const isMissingMode = !!filteredSteps;
  const stepsToShow = filteredSteps || (isOnboarding ? ONBOARDING_STEPS : STEP_ORDER);
  const [currentFilteredIndex, setCurrentFilteredIndex] = useState(0);
  const currentStep = (isMissingMode || isOnboarding)
    ? STEP_ORDER.indexOf(stepsToShow[currentFilteredIndex])
    : currentFilteredIndex;
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [photos, setPhotos] = useState<string[]>(user?.photos || (user?.profilePicture ? [user.profilePicture] : []));
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [birthdayError, setBirthdayError] = useState('');
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [budget, setBudget] = useState(user?.profileData?.budget?.toString() || '');
  const [lookingFor, setLookingFor] = useState<'room' | 'entire_apartment' | undefined>(user?.profileData?.lookingFor);
  const [location, setLocation] = useState(user?.profileData?.location || '');
  const [selectedState, setSelectedState] = useState(user?.profileData?.state || '');
  const [selectedCity, setSelectedCity] = useState(user?.profileData?.city || '');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(user?.profileData?.neighborhood || '');
  const [occupation, setOccupation] = useState(user?.profileData?.occupation || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>(user?.profileData?.gender);
  const [sleepSchedule, setSleepSchedule] = useState<'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular' | undefined>(user?.profileData?.preferences?.sleepSchedule);
  const [cleanliness, setCleanliness] = useState<'very_tidy' | 'moderately_tidy' | 'relaxed' | undefined>(user?.profileData?.preferences?.cleanliness);
  const [guestPolicy, setGuestPolicy] = useState<'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests' | undefined>(user?.profileData?.preferences?.guestPolicy);
  const [noiseTolerance, setNoiseTolerance] = useState<'prefer_quiet' | 'normal_noise' | 'loud_environments' | undefined>(user?.profileData?.preferences?.noiseTolerance);
  const [smoking, setSmoking] = useState<'yes' | 'no' | 'only_outside' | undefined>(user?.profileData?.preferences?.smoking);
  const [workLocation, setWorkLocation] = useState<'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular' | undefined>(user?.profileData?.preferences?.workLocation);
  const [roommateRelationship, setRoommateRelationship] = useState<'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction' | undefined>(user?.profileData?.preferences?.roommateRelationship);
  const [pets, setPets] = useState<'have_pets' | 'open_to_pets' | 'no_pets' | undefined>(user?.profileData?.preferences?.pets);
  const [interests, setInterests] = useState<string[]>(
    Array.isArray(user?.profileData?.interests) ? user.profileData.interests : []
  );
  const [expenseUtilities, setExpenseUtilities] = useState<'split_equally' | 'usage_based' | 'included_in_rent' | undefined>(user?.profileData?.preferences?.sharedExpenses?.utilities);
  const [expenseGroceries, setExpenseGroceries] = useState<'split_equally' | 'buy_own' | 'shared_basics' | undefined>(user?.profileData?.preferences?.sharedExpenses?.groceries);
  const [expenseInternet, setExpenseInternet] = useState<'split_equally' | 'one_pays' | 'included_in_rent' | undefined>(user?.profileData?.preferences?.sharedExpenses?.internet);
  const [expenseCleaning, setExpenseCleaning] = useState<'split_equally' | 'take_turns' | 'hire_cleaner' | undefined>(user?.profileData?.preferences?.sharedExpenses?.cleaning);
  const [moveInDate, setMoveInDate] = useState(user?.profileData?.preferences?.moveInDate || '');
  const [showMoveInPicker, setShowMoveInPicker] = useState(false);
  const [bedrooms, setBedrooms] = useState(user?.profileData?.preferences?.bedrooms?.toString() || '');
  const [bathrooms, setBathrooms] = useState(user?.profileData?.preferences?.bathrooms?.toString() || '');
  const [privateBathroom, setPrivateBathroom] = useState<boolean | undefined>(user?.profileData?.preferences?.privateBathroom);

  const [personalityAnswers, setPersonalityAnswers] = useState<Record<string, string>>(
    user?.profileData?.personalityAnswers || {}
  );

  useEffect(() => {
    if (user?.photos && user.photos.length > 0) {
      setPhotos(user.photos);
    } else if (user?.profilePicture) {
      setPhotos([user.profilePicture]);
    }
  }, [user?.photos, user?.profilePicture]);

  const validateBirthday = (dateString: string): { valid: boolean; error: string } => {
    if (!dateString.trim()) return { valid: false, error: 'Please enter your date of birth' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return { valid: false, error: 'Please select your date of birth' };
    if (!isAtLeast18(dateString)) return { valid: false, error: 'You must be at least 18 years old' };
    return { valid: true, error: '' };
  };

  const pickImage = async () => {
    if (photos.length >= 6) {
      await showAlert({ title: 'Maximum Reached', message: 'You can upload up to 6 photos', variant: 'warning' });
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
            showAlert({ title: 'File Too Large', message: 'Please select an image smaller than 10MB', variant: 'warning' });
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
      await showAlert({ title: 'Permission Required', message: 'Photo library access is required to add photos.', variant: 'warning' });
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
      await showAlert({ title: 'Error', message: 'Failed to pick image.', variant: 'warning' });
    }
  };


  const validateCurrentStep = async (): Promise<boolean> => {
    const stepId = STEP_ORDER[currentStep];
    switch (stepId) {
      case 'photos':
        if (photos.length === 0) { await showAlert({ title: 'Required', message: 'Please add at least one photo', variant: 'warning' }); return false; }
        return true;
      case 'basicInfo':
        if (!name.trim()) { await showAlert({ title: 'Required', message: 'Please enter your name', variant: 'warning' }); return false; }
        if (!email.trim()) { await showAlert({ title: 'Required', message: 'Please enter your email', variant: 'warning' }); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { await showAlert({ title: 'Error', message: 'Please enter a valid email', variant: 'warning' }); return false; }
        if (!birthday.trim()) { await showAlert({ title: 'Required', message: 'Please enter your date of birth', variant: 'warning' }); return false; }
        const v = validateBirthday(birthday);
        if (!v.valid) { setBirthdayError(v.error); await showAlert({ title: 'Error', message: v.error, variant: 'warning' }); return false; }
        return true;
      case 'gender':
        if (!gender) { await showAlert({ title: 'Required', message: 'Please select your gender', variant: 'warning' }); return false; }
        return true;
      case 'locationOccupation':
        if (!selectedCity && !location.trim()) { await showAlert({ title: 'Required', message: 'Please select a location', variant: 'warning' }); return false; }
        return true;
      case 'bio':
        if (!bio.trim()) { await showAlert({ title: 'Required', message: 'Please write a short bio', variant: 'warning' }); return false; }
        return true;
      case 'sleepSchedule':
        if (!sleepSchedule) { await showAlert({ title: 'Required', message: 'Please select your sleep schedule', variant: 'warning' }); return false; }
        return true;
      case 'cleanliness':
        if (!cleanliness) { await showAlert({ title: 'Required', message: 'Please select your cleanliness level', variant: 'warning' }); return false; }
        return true;
      case 'smoking':
        if (!smoking) { await showAlert({ title: 'Required', message: 'Please select your smoking preference', variant: 'warning' }); return false; }
        return true;
      case 'social':
        if (!guestPolicy) { await showAlert({ title: 'Required', message: 'Please select your guest policy', variant: 'warning' }); return false; }
        if (!roommateRelationship) { await showAlert({ title: 'Required', message: 'Please select your roommate relationship preference', variant: 'warning' }); return false; }
        return true;
      case 'noiseTolerance':
        if (!noiseTolerance) { await showAlert({ title: 'Required', message: 'Please select your noise tolerance', variant: 'warning' }); return false; }
        return true;
      case 'workPets':
        if (!workLocation) { await showAlert({ title: 'Required', message: 'Please select your work location', variant: 'warning' }); return false; }
        if (!pets) { await showAlert({ title: 'Required', message: 'Please select your pet preference', variant: 'warning' }); return false; }
        return true;
      case 'housing':
        if (!budget.trim()) { await showAlert({ title: 'Required', message: 'Please enter your monthly budget', variant: 'warning' }); return false; }
        if (isNaN(parseInt(budget)) || parseInt(budget) <= 0) { await showAlert({ title: 'Error', message: 'Please enter a valid budget amount', variant: 'warning' }); return false; }
        if (!lookingFor) { await showAlert({ title: 'Required', message: 'Please select what you are looking for', variant: 'warning' }); return false; }
        if (!moveInDate.trim()) { await showAlert({ title: 'Required', message: 'Please select your move-in date', variant: 'warning' }); return false; }
        if (!bedrooms.trim()) { await showAlert({ title: 'Required', message: 'Please enter the number of bedrooms', variant: 'warning' }); return false; }
        if (isNaN(parseInt(bedrooms)) || parseInt(bedrooms) <= 0) { await showAlert({ title: 'Error', message: 'Please enter a valid number of bedrooms', variant: 'warning' }); return false; }
        if (!bathrooms.trim()) { await showAlert({ title: 'Required', message: 'Please enter the number of bathrooms', variant: 'warning' }); return false; }
        if (isNaN(parseInt(bathrooms)) || parseInt(bathrooms) <= 0) { await showAlert({ title: 'Error', message: 'Please enter a valid number of bathrooms', variant: 'warning' }); return false; }
        if (lookingFor !== 'entire_apartment' && privateBathroom === undefined) { await showAlert({ title: 'Required', message: 'Please select whether you need a private or shared bathroom', variant: 'warning' }); return false; }
        return true;
      case 'interests': {
        const tagIdsByCategory: Record<string, string[]> = {};
        for (const [key, cat] of Object.entries(INTEREST_TAGS)) {
          tagIdsByCategory[key] = cat.tags.map(t => t.id);
        }
        const result = validateInterestTags(interests, tagIdsByCategory);
        if (!result.valid) { await showAlert({ title: 'Required', message: result.message, variant: 'warning' }); return false; }
        return true;
      }
      case 'expenses':
        if (!expenseUtilities) { await showAlert({ title: 'Required', message: 'Please select how to split utilities', variant: 'warning' }); return false; }
        if (!expenseGroceries) { await showAlert({ title: 'Required', message: 'Please select how to handle groceries', variant: 'warning' }); return false; }
        if (!expenseInternet) { await showAlert({ title: 'Required', message: 'Please select how to handle internet', variant: 'warning' }); return false; }
        if (!expenseCleaning) { await showAlert({ title: 'Required', message: 'Please select how to handle cleaning', variant: 'warning' }); return false; }
        return true;
      case 'personality':
        if (Object.keys(personalityAnswers).length < 5) {
          await showAlert({ title: 'Required', message: 'Please answer all 5 questions', variant: 'warning' });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const buildProfileData = () => {
    const birthdayStorageFormat = birthday.trim() || user?.birthday;
    const zodiacSign = birthdayStorageFormat ? calculateZodiacFromBirthday(birthdayStorageFormat) : undefined;
    return {
      name: name.trim() || user?.name,
      email: email.trim() || user?.email,
      birthday: birthdayStorageFormat,
      zodiacSign,
      photos: photos.length > 0 ? photos : user?.photos,
      profilePicture: photos[0] || user?.profilePicture,
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
        interests: interests.length > 0 ? interests : undefined,
        gender,
        personalityAnswers: Object.keys(personalityAnswers).length > 0 ? personalityAnswers : undefined,
        preferences: {
          sleepSchedule,
          cleanliness,
          guestPolicy,
          noiseTolerance,
          smoking,
          workLocation,
          roommateRelationship,
          pets,
          moveInDate: moveInDate.trim() || undefined,
          bedrooms: bedrooms.trim() ? parseInt(bedrooms) : undefined,
          bathrooms: bathrooms.trim() ? parseInt(bathrooms) : undefined,
          privateBathroom: lookingFor === 'entire_apartment' ? true : privateBathroom,
          sharedExpenses: {
            utilities: expenseUtilities,
            groceries: expenseGroceries,
            internet: expenseInternet,
            cleaning: expenseCleaning,
          },
        },
      },
    };
  };

  const goNext = async () => {
    if (!(await validateCurrentStep())) return;
    if (currentFilteredIndex < stepsToShow.length - 1) {
      setDirection('forward');
      setCurrentFilteredIndex(currentFilteredIndex + 1);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      updateUser(buildProfileData()).catch(() => {});
    }
  };

  const goBack = async () => {
    console.log('[ProfileQuestionnaire] goBack pressed, currentFilteredIndex:', currentFilteredIndex, 'onboardingStep:', user?.onboardingStep);
    if (currentFilteredIndex > 0) {
      setDirection('back');
      setCurrentFilteredIndex(currentFilteredIndex - 1);
    } else {
      if (user?.onboardingStep === 'profile') {
        const confirmed = await confirm({
          title: 'Go Back',
          message: 'This will return you to the login screen. Any progress will not be saved.',
          confirmText: 'Go Back',
          cancelText: 'Stay',
          variant: 'danger',
        });
        if (confirmed) abandonSignup();
      } else {
        navigation.goBack();
      }
    }
  };

  const handleSave = async () => {
    if (!(await validateCurrentStep())) return;
    setIsSaving(true);

    await updateUser(buildProfileData());

    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setIsSaving(false);
    if (user?.onboardingStep === 'profile') {
      await completeOnboardingStep(user?.role === 'host' ? 'hostType' : 'plan');
    } else {
      navigation.goBack();
    }
  };

  const isLastStep = currentFilteredIndex === stepsToShow.length - 1;

  const renderSubSectionHeader = (label: string) => (
    <View style={styles.subSectionHeader}>
      <View style={styles.subSectionBar} />
      <ThemedText style={styles.subSectionTitle}>{label}</ThemedText>
    </View>
  );

  const renderStepContent = () => {
    const stepId = STEP_ORDER[currentStep];

    switch (stepId) {
      case 'photos':
        return (
          <View style={styles.stepInner}>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={`photo-${index}`} style={styles.photoSlot}>
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                  {index === 0 ? (
                    <View style={styles.mainBadge}>
                      <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 11 }}>Main</ThemedText>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 6 ? (
                <Pressable
                  style={[styles.photoSlot, styles.addPhotoSlot]}
                  onPress={pickImage}
                >
                  <View style={styles.addPhotoIcon}>
                    <Feather name="camera" size={22} color="rgba(255,255,255,0.4)" />
                  </View>
                  <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>Add Photo</ThemedText>
                </Pressable>
              ) : null}
            </View>
            <ThemedText style={styles.photoHint}>First photo is your main profile picture</ThemedText>
          </View>
        );

      case 'basicInfo':
        return (
          <View style={styles.stepInner}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Name *</ThemedText>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Email *</ThemedText>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Date of Birth *</ThemedText>
              <Pressable
                style={[styles.dateTrigger, { borderColor: birthdayError ? theme.error : '#2a2a2a' }]}
                onPress={() => setShowBirthdayPicker(true)}
              >
                <Feather name="calendar" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 12 }} />
                <ThemedText style={{ color: birthday ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16, flex: 1 }}>
                  {birthday ? formatDate(birthday) : 'Select your birthday'}
                </ThemedText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
              </Pressable>
              {birthdayError ? (
                <ThemedText style={{ color: theme.error, fontSize: 12, marginTop: 4 }}>{birthdayError}</ThemedText>
              ) : null}
              <DatePickerModal
                visible={showBirthdayPicker}
                onClose={() => setShowBirthdayPicker(false)}
                onConfirm={(date) => { setBirthday(date); setBirthdayError(''); }}
                mode="birthday"
                title="Enter Your Birthday"
                initialDate={birthday || undefined}
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
              <ThemedText style={styles.inputLabel}>Occupation</ThemedText>
              <ThemedText style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: Spacing.sm }}>Select the option that best describes what you do</ThemedText>
              <OccupationBarSelector
                selectedOccupation={occupation}
                onChange={setOccupation}
              />
            </View>
          </View>
        );

      case 'bio':
        return (
          <View style={styles.stepInner}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell potential roommates about yourself, your hobbies, and what you're looking for..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'right', marginTop: 6 }}>
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
            {renderSubSectionHeader('Guest Policy')}
            <SelectionCard icon="user-x" title="Rarely" isSelected={guestPolicy === 'rarely'} onPress={() => setGuestPolicy('rarely')} index={0} />
            <SelectionCard icon="user-check" title="Occasionally" isSelected={guestPolicy === 'occasionally'} onPress={() => setGuestPolicy('occasionally')} index={1} />
            <SelectionCard icon="users" title="Frequently" isSelected={guestPolicy === 'frequently'} onPress={() => setGuestPolicy('frequently')} index={2} />
            <SelectionCard icon="x" title="Prefer No Guests" isSelected={guestPolicy === 'prefer_no_guests'} onPress={() => setGuestPolicy('prefer_no_guests')} index={3} />

            <View style={{ height: 24 }} />

            {renderSubSectionHeader('Roommate Relationship')}
            <SelectionCard icon="shield" title="Respectful Co-living" subtitle="Keep things friendly but independent" isSelected={roommateRelationship === 'respectful_coliving'} onPress={() => setRoommateRelationship('respectful_coliving')} index={0} />
            <SelectionCard icon="coffee" title="Occasional Hangouts" subtitle="Grab a meal or watch a show together sometimes" isSelected={roommateRelationship === 'occasional_hangouts'} onPress={() => setRoommateRelationship('occasional_hangouts')} index={1} />
            <SelectionCard icon="heart" title="Prefer Friends" subtitle="Looking for a roommate who becomes a friend" isSelected={roommateRelationship === 'prefer_friends'} onPress={() => setRoommateRelationship('prefer_friends')} index={2} />
            <SelectionCard icon="minimize-2" title="Minimal Interaction" subtitle="Prefer to keep to myself" isSelected={roommateRelationship === 'minimal_interaction'} onPress={() => setRoommateRelationship('minimal_interaction')} index={3} />
          </View>
        );

      case 'noiseTolerance':
        return (
          <View style={styles.stepInner}>
            <SelectionCard icon="volume-x" title="Prefer Quiet" subtitle="I need a peaceful space to focus and relax" isSelected={noiseTolerance === 'prefer_quiet'} onPress={() => setNoiseTolerance('prefer_quiet')} index={0} />
            <SelectionCard icon="volume-1" title="Normal Noise is Fine" subtitle="Everyday sounds don't bother me" isSelected={noiseTolerance === 'normal_noise'} onPress={() => setNoiseTolerance('normal_noise')} index={1} />
            <SelectionCard icon="volume-2" title="Loud Environments are OK" subtitle="Music, TV, and lively spaces are welcome" isSelected={noiseTolerance === 'loud_environments'} onPress={() => setNoiseTolerance('loud_environments')} index={2} />
          </View>
        );

      case 'workPets':
        return (
          <View style={styles.stepInner}>
            {renderSubSectionHeader('Work Location')}
            <SelectionCard icon="home" title="Work From Home" subtitle="Full-time remote" isSelected={workLocation === 'wfh_fulltime'} onPress={() => setWorkLocation('wfh_fulltime')} index={0} />
            <SelectionCard icon="repeat" title="Hybrid" subtitle="Mix of home and office" isSelected={workLocation === 'hybrid'} onPress={() => setWorkLocation('hybrid')} index={1} />
            <SelectionCard icon="briefcase" title="Office Full-time" subtitle="Out of the house all day" isSelected={workLocation === 'office_fulltime'} onPress={() => setWorkLocation('office_fulltime')} index={2} />
            <SelectionCard icon="shuffle" title="Irregular Schedule" isSelected={workLocation === 'irregular'} onPress={() => setWorkLocation('irregular')} index={3} />

            <View style={{ height: 24 }} />

            {renderSubSectionHeader('Pets')}
            <SelectionCard icon="heart" title="I Have Pets" isSelected={pets === 'have_pets'} onPress={() => setPets('have_pets')} index={0} />
            <SelectionCard icon="smile" title="Open to Pets" isSelected={pets === 'open_to_pets'} onPress={() => setPets('open_to_pets')} index={1} />
            <SelectionCard icon="x-circle" title="Prefer No Pets" subtitle="Allergies or personal preference" isSelected={pets === 'no_pets'} onPress={() => setPets('no_pets')} index={2} />
          </View>
        );

      case 'housing':
        return (
          <View style={styles.stepInner}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Monthly Budget</ThemedText>
              <View style={styles.budgetInputRow}>
                <ThemedText style={styles.budgetPrefix}>$</ThemedText>
                <TextInput
                  style={styles.budgetInput}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="1500"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <ThemedText style={[styles.inputLabel, { marginBottom: 10, marginTop: 4 }]}>Looking For</ThemedText>
            <SelectionCard icon="grid" title="A Room" subtitle="Shared apartment" isSelected={lookingFor === 'room'} onPress={() => setLookingFor('room')} index={0} />
            <SelectionCard icon="home" title="Entire Apartment" subtitle="Full place for you and roommates" isSelected={lookingFor === 'entire_apartment'} onPress={() => setLookingFor('entire_apartment')} index={1} />

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { marginTop: 12 }]}>Move-in Date</ThemedText>
              <Pressable
                style={styles.dateTrigger}
                onPress={() => setShowMoveInPicker(true)}
              >
                <Feather name="calendar" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 12 }} />
                <ThemedText style={{ color: moveInDate ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16, flex: 1 }}>
                  {moveInDate ? formatDate(moveInDate) : 'Select move-in date'}
                </ThemedText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
              </Pressable>
              <DatePickerModal
                visible={showMoveInPicker}
                onClose={() => setShowMoveInPicker(false)}
                onConfirm={(date) => setMoveInDate(date)}
                mode="moveIn"
                title="Select Move-In Date"
                initialDate={moveInDate || undefined}
                tierLimit={getTierLimit((user?.subscription?.plan as 'basic' | 'plus' | 'elite') || 'basic')}
                userPlan={(user?.subscription?.plan as 'basic' | 'plus' | 'elite') || 'basic'}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Bedrooms</ThemedText>
              <TextInput
                style={styles.textInput}
                value={bedrooms}
                onChangeText={setBedrooms}
                placeholder="2"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Bathrooms</ThemedText>
              <TextInput
                style={styles.textInput}
                value={bathrooms}
                onChangeText={setBathrooms}
                placeholder="1"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
              />
            </View>

            {lookingFor !== 'entire_apartment' ? (
              <>
                <ThemedText style={[styles.inputLabel, { marginBottom: 10, marginTop: 4 }]}>Private Bathroom</ThemedText>
                <SelectionCard icon="check-circle" title="Yes, I need a private bathroom" isSelected={privateBathroom === true} onPress={() => setPrivateBathroom(true)} index={0} />
                <SelectionCard icon="users" title="Shared bathroom is fine" isSelected={privateBathroom === false} onPress={() => setPrivateBathroom(false)} index={1} />
              </>
            ) : null}
          </View>
        );

      case 'interests':
        return (
          <View style={styles.stepInner}>
            <InterestCategoryBars
              selectedTags={interests}
              onChange={setInterests}
              maxTags={10}
            />
          </View>
        );

      case 'expenses':
        return (
          <View style={styles.stepInner}>
            {renderSubSectionHeader('Utilities')}
            <SelectionCard icon="zap" title="Split Equally" isSelected={expenseUtilities === 'split_equally'} onPress={() => setExpenseUtilities('split_equally')} index={0} />
            <SelectionCard icon="bar-chart" title="Based on Usage" isSelected={expenseUtilities === 'usage_based'} onPress={() => setExpenseUtilities('usage_based')} index={1} />
            <SelectionCard icon="home" title="Included in Rent" isSelected={expenseUtilities === 'included_in_rent'} onPress={() => setExpenseUtilities('included_in_rent')} index={2} />

            <View style={{ height: 20 }} />
            {renderSubSectionHeader('Groceries')}
            <SelectionCard icon="shopping-cart" title="Split Equally" isSelected={expenseGroceries === 'split_equally'} onPress={() => setExpenseGroceries('split_equally')} index={0} />
            <SelectionCard icon="shopping-bag" title="Everyone Buys Their Own" isSelected={expenseGroceries === 'buy_own'} onPress={() => setExpenseGroceries('buy_own')} index={1} />
            <SelectionCard icon="share-2" title="Share Basics" isSelected={expenseGroceries === 'shared_basics'} onPress={() => setExpenseGroceries('shared_basics')} index={2} />

            <View style={{ height: 20 }} />
            {renderSubSectionHeader('Internet / WiFi')}
            <SelectionCard icon="wifi" title="Split Equally" isSelected={expenseInternet === 'split_equally'} onPress={() => setExpenseInternet('split_equally')} index={0} />
            <SelectionCard icon="user" title="One Person Pays" isSelected={expenseInternet === 'one_pays'} onPress={() => setExpenseInternet('one_pays')} index={1} />
            <SelectionCard icon="home" title="Included in Rent" isSelected={expenseInternet === 'included_in_rent'} onPress={() => setExpenseInternet('included_in_rent')} index={2} />

            <View style={{ height: 20 }} />
            {renderSubSectionHeader('Cleaning Supplies')}
            <SelectionCard icon="droplet" title="Split Equally" isSelected={expenseCleaning === 'split_equally'} onPress={() => setExpenseCleaning('split_equally')} index={0} />
            <SelectionCard icon="refresh-cw" title="Take Turns Buying" isSelected={expenseCleaning === 'take_turns'} onPress={() => setExpenseCleaning('take_turns')} index={1} />
            <SelectionCard icon="award" title="Hire a Cleaner" isSelected={expenseCleaning === 'hire_cleaner'} onPress={() => setExpenseCleaning('hire_cleaner')} index={2} />
          </View>
        );

      case 'personality': {
        const PERSONALITY_QUESTIONS = [
          {
            id: 'q1',
            question: 'When you get home after a long day:',
            options: [
              { value: 'alone', emoji: '🛋️', label: 'Decompress alone quietly' },
              { value: 'music', emoji: '🎵', label: 'Put on music and unwind' },
              { value: 'social', emoji: '📱', label: 'Call friends or family' },
              { value: 'kitchen', emoji: '🍳', label: 'Cook and relax in the kitchen' },
            ],
          },
          {
            id: 'q2',
            question: 'Your ideal weekend at home:',
            options: [
              { value: 'clean', emoji: '🧹', label: 'Deep clean and organize' },
              { value: 'chill', emoji: '🎮', label: 'Games, movies, total chill' },
              { value: 'social', emoji: '🏠', label: 'Have people over' },
              { value: 'out', emoji: '🚶', label: 'Out most of the time' },
            ],
          },
          {
            id: 'q3',
            question: 'Shared spaces should be:',
            options: [
              { value: 'spotless', emoji: '✨', label: 'Spotless — clean as you go' },
              { value: 'tidy', emoji: '👍', label: 'Tidy — cleaned weekly' },
              { value: 'relaxed', emoji: '😌', label: 'Relaxed — cleaned when needed' },
              { value: 'doesnt_matter', emoji: '🤷', label: "Doesn't bother me" },
            ],
          },
          {
            id: 'q4',
            question: 'Guests at home:',
            options: [
              { value: 'advance', emoji: '❌', label: 'Always let me know in advance' },
              { value: 'headsup', emoji: '👋', label: 'Occasionally fine with a heads up' },
              { value: 'open', emoji: '✅', label: 'Come anytime' },
              { value: 'love', emoji: '🎉', label: 'Love it, the more the merrier' },
            ],
          },
          {
            id: 'q5',
            question: 'Your communication style:',
            options: [
              { value: 'text', emoji: '💬', label: 'Text everything' },
              { value: 'direct', emoji: '🗣️', label: 'Direct — face to face' },
              { value: 'meeting', emoji: '📋', label: 'Group house meeting' },
              { value: 'flow', emoji: '😎', label: 'Go with the flow' },
            ],
          },
        ];

        return (
          <View style={styles.stepInner}>
            {PERSONALITY_QUESTIONS.map((q) => (
              <View key={q.id} style={{ marginBottom: 24 }}>
                <ThemedText style={styles.questionText}>{q.question}</ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {q.options.map((opt) => {
                    const isSelected = personalityAnswers[q.id] === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPersonalityAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
                        style={[styles.personalityOption, isSelected && styles.personalityOptionSelected]}
                      >
                        <Text style={styles.personalityEmoji}>{opt.emoji}</Text>
                        <ThemedText style={styles.personalityLabel}>{opt.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        );
      }

      default:
        return null;
    }
  };

  const currentStepId = STEP_ORDER[currentStep];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={goBack} style={styles.navButton} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#fff' }}>
            {isMissingMode ? `${currentFilteredIndex + 1} of ${stepsToShow.length}` : (currentFilteredIndex === 0 ? (isOnboarding ? 'Create Profile' : 'Edit Profile') : '')}
          </ThemedText>
          {isMissingMode ? (
            <Pressable onPress={() => navigation.goBack()} style={styles.navButton}>
              <Feather name="x" size={24} color="rgba(255,255,255,0.5)" />
            </Pressable>
          ) : (
            <View style={styles.navButton} />
          )}
        </View>
        <View style={styles.progressWrap}>
          <ProgressBar currentStep={currentFilteredIndex} totalSteps={stepsToShow.length} />
        </View>
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
          <View style={styles.stepHeader}>
            <View style={styles.stepIconWrap}>
              <Feather name={STEP_ICONS[currentStepId]} size={28} color="#ff6b5b" />
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{currentFilteredIndex + 1} of {stepsToShow.length}</Text>
            </View>
            <ThemedText style={styles.stepTitle}>{STEP_TITLES[currentStepId]}</ThemedText>
            <ThemedText style={styles.stepSubtitle}>{STEP_SUBTITLES[currentStepId]}</ThemedText>
          </View>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 16) + 80 }]}>
        {isLastStep ? (
          <Pressable
            style={[styles.nextButton, { opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText style={styles.nextButtonText}>{isMissingMode ? 'Save' : 'Save Profile'}</ThemedText>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable style={styles.nextButton} onPress={goNext}>
            <ThemedText style={styles.nextButtonText}>Next</ThemedText>
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
    backgroundColor: '#111',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 32,
  },
  stepHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  stepIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepInner: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  textInput: {
    height: 52,
    backgroundColor: '#1c1c1c',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#fff',
  },
  bioInput: {
    height: 140,
    backgroundColor: '#1c1c1c',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    textAlignVertical: 'top',
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 18,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 18,
  },
  budgetPrefix: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    marginRight: 8,
  },
  budgetInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingTop: 8,
  },
  photoSlot: {
    width: 105,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  addPhotoSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1c',
  },
  addPhotoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ff6b5b',
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.9)',
  },
  photoHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 14,
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  subSectionBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#ff6b5b',
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 14,
    marginTop: 4,
  },
  personalityOption: {
    width: '48%',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#1c1c1c',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    flexGrow: 1,
  },
  personalityOptionSelected: {
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderColor: '#ff6b5b',
  },
  personalityEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  personalityLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ff6b5b',
    gap: 8,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
