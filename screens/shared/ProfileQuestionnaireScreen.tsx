import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
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
import { calculateZodiacFromBirthday } from '../../utils/zodiacUtils';
import { ProgressBar } from '../../components/questionnaire/ProgressBar';
import { LocationPicker } from '../../components/LocationPicker';
import { getCoordinatesFromNeighborhood } from '../../utils/locationData';
import { BOROUGH_NEIGHBORHOODS } from '../../constants/transitData';
import { updateProfile } from '../../services/profileService';

const TOTAL_STEPS = 12;

function EmojiTileGrid({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: { value: string; emoji: string; label: string; subtitle?: string }[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multiSelect?: boolean;
}) {
  const { theme } = useTheme();
  const isActive = (value: string) =>
    multiSelect ? (selected as string[]).includes(value) : selected === value;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map((opt) => {
        const active = isActive(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={{
              width: '47%',
              backgroundColor: active ? theme.primary + '20' : theme.backgroundSecondary,
              borderWidth: 2,
              borderColor: active ? theme.primary : theme.border,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 12,
              alignItems: 'center',
              gap: 6,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 28 }}>{opt.emoji}</Text>
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              color: active ? theme.primary : theme.text,
              textAlign: 'center',
            }}>
              {opt.label}
            </Text>
            {opt.subtitle ? (
              <Text style={{
                fontSize: 11,
                color: theme.textSecondary,
                textAlign: 'center',
                lineHeight: 14,
              }}>
                {opt.subtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BinaryChoice({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; emoji: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={{
              flex: 1,
              backgroundColor: active ? theme.primary : theme.backgroundSecondary,
              borderWidth: 2,
              borderColor: active ? theme.primary : theme.border,
              borderRadius: 18,
              paddingVertical: 28,
              alignItems: 'center',
              gap: 10,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 36 }}>{opt.emoji}</Text>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: active ? '#fff' : theme.text,
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function IconScale({
  levels,
  selected,
  onSelect,
}: {
  levels: { value: string; emoji: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        {levels.map((level) => {
          const active = selected === level.value;
          return (
            <TouchableOpacity
              key={level.value}
              onPress={() => onSelect(level.value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                marginHorizontal: 3,
                backgroundColor: active ? theme.primary + '20' : theme.backgroundSecondary,
                borderWidth: 2,
                borderColor: active ? theme.primary : theme.border,
                borderRadius: 12,
                gap: 4,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24 }}>{level.emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected ? (
        <Text style={{
          textAlign: 'center',
          color: theme.primary,
          fontWeight: '600',
          fontSize: 14,
          marginTop: 6,
        }}>
          {levels.find(l => l.value === selected)?.label}
        </Text>
      ) : null}
    </View>
  );
}

function CheckboxPills({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string; emoji: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onToggle(opt.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: active ? theme.primary + '20' : theme.backgroundSecondary,
              borderWidth: 2,
              borderColor: active ? theme.primary : theme.border,
              borderRadius: 100,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>{opt.emoji}</Text>
            <Text style={{
              fontSize: 13,
              fontWeight: active ? '700' : '500',
              color: active ? theme.primary : theme.text,
            }}>
              {opt.label}
            </Text>
            {active ? (
              <Feather name="check-circle" size={16} color={theme.primary} />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type StepId =
  | 'photos'
  | 'basicInfo'
  | 'budgetLocation'
  | 'dealbreakers'
  | 'sleepCleanliness'
  | 'smokingPets'
  | 'lifestyle'
  | 'housing'
  | 'roommateSetup'
  | 'interests'
  | 'personality'
  | 'profileNote'
  | 'idealRoommate';

const STEP_ORDER: StepId[] = [
  'photos',
  'basicInfo',
  'budgetLocation',
  'dealbreakers',
  'sleepCleanliness',
  'smokingPets',
  'lifestyle',
  'housing',
  'roommateSetup',
  'interests',
  'personality',
  'profileNote',
  'idealRoommate',
];

const ONBOARDING_STEPS: StepId[] = [
  'photos',
  'basicInfo',
  'budgetLocation',
];

const ONBOARDING_STEPS_LITE: StepId[] = [
  'photos',
  'basicInfo',
  'budgetLocation',
];

const STEP_TITLES: Record<StepId, string> = {
  photos: 'Add Your Photos',
  basicInfo: 'About You',
  budgetLocation: 'Budget & Location',
  dealbreakers: 'Any Dealbreakers?',
  sleepCleanliness: 'Sleep & Cleanliness',
  smokingPets: 'Smoking & Pets',
  lifestyle: 'Your Lifestyle',
  housing: 'Housing Needs',
  roommateSetup: 'Roommate Preferences',
  interests: 'Interests',
  personality: 'Your Living Style',
  profileNote: 'In Your Own Words',
  idealRoommate: 'Your Ideal Roommate',
};

const STEP_SUBTITLES: Record<StepId, string> = {
  photos: 'Add up to 6 photos. Your first photo is your main profile picture.',
  basicInfo: 'Let others know who you are.',
  budgetLocation: 'This is how we filter your matches. Be honest \u2014 it helps.',
  dealbreakers: 'These filter out incompatible matches entirely. Select everything that applies.',
  sleepCleanliness: 'The top two causes of roommate friction. Be honest.',
  smokingPets: 'Hard preferences \u2014 we use these to filter your matches.',
  lifestyle: 'How you actually live day-to-day.',
  housing: 'What you need in your next place.',
  roommateSetup: 'Help Pi find your ideal roommate group.',
  interests: 'Pick at least 1 tag from each category.',
  personality: 'How you live with others.',
  profileNote: 'Write anything you want potential roommates to know about you.',
  idealRoommate: 'Describe your ideal roommate in your own words. Pi uses this to find better matches.',
};

const STEP_ICONS: Record<StepId, keyof typeof Feather.glyphMap> = {
  photos: 'camera',
  basicInfo: 'user',
  budgetLocation: 'dollar-sign',
  dealbreakers: 'shield',
  sleepCleanliness: 'moon',
  smokingPets: 'wind',
  lifestyle: 'users',
  housing: 'home',
  roommateSetup: 'users',
  interests: 'star',
  personality: 'cpu',
  profileNote: 'edit-3',
  idealRoommate: 'cpu',
};

export const ProfileQuestionnaireScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep, logout, abandonSignup } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const isOnboarding = user?.onboardingStep === 'profile';
  const isLiteOnboarding = isOnboarding && user?.role === 'renter' && (
    user?.profileData?.apartment_search_type === 'solo' || user?.profileData?.apartment_search_type === 'with_partner'
  );
  const missingStepsParam = (route.params as any)?.missingSteps as string[] | undefined;
  const filteredSteps = React.useMemo(() => {
    if (missingStepsParam?.length) {
      return missingStepsParam.filter(s => STEP_ORDER.includes(s as StepId)) as StepId[];
    }
    return null;
  }, []);
  const isMissingMode = !!filteredSteps;
  const stepsToShow = filteredSteps || (isLiteOnboarding ? ONBOARDING_STEPS_LITE : isOnboarding ? ONBOARDING_STEPS : STEP_ORDER);
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
  const [preferredNeighborhoods, setPreferredNeighborhoods] = useState<string[]>(user?.profileData?.preferred_neighborhoods || []);
  const [zipCode, setZipCode] = useState(user?.profileData?.zip_code || user?.zip_code || '');
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
  const [dealbreakers, setDealbreakers] = useState<string[]>(
    user?.profileData?.dealbreakers || []
  );
  const [budgetMin, setBudgetMin] = useState(user?.profileData?.budgetMin?.toString() || '');
  const [profileNote, setProfileNote] = useState(user?.profileData?.profileNote || '');
  const profileNoteCharLimit = 500;
  const [idealRoommateText, setIdealRoommateText] = useState(user?.profileData?.ideal_roommate_text || user?.ideal_roommate_text || '');
  const idealRoommateTextRef = React.useRef(idealRoommateText);
  React.useEffect(() => { idealRoommateTextRef.current = idealRoommateText; }, [idealRoommateText]);
  const idealRoommateCharLimit = 500;

  const [desiredRoommateCount, setDesiredRoommateCount] = useState<number>(user?.profileData?.desired_roommate_count ?? user?.desired_roommate_count ?? 0);
  const [desiredBedroomCount, setDesiredBedroomCount] = useState<number>(user?.profileData?.desired_bedroom_count ?? user?.desired_bedroom_count ?? 0);
  const [householdGenderPref, setHouseholdGenderPref] = useState<'any' | 'male_only' | 'female_only' | 'same_gender'>(user?.profileData?.household_gender_preference || user?.household_gender_preference || 'any');
  const [piAutoMatchEnabled, setPiAutoMatchEnabled] = useState<boolean>(user?.profileData?.pi_auto_match_enabled ?? user?.pi_auto_match_enabled ?? true);

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
      case 'basicInfo': {
        if (!name.trim()) { await showAlert({ title: 'Required', message: 'Please enter your name', variant: 'warning' }); return false; }
        if (!email.trim()) { await showAlert({ title: 'Required', message: 'Please enter your email', variant: 'warning' }); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { await showAlert({ title: 'Error', message: 'Please enter a valid email', variant: 'warning' }); return false; }
        if (!birthday.trim()) { await showAlert({ title: 'Required', message: 'Please enter your date of birth', variant: 'warning' }); return false; }
        const v = validateBirthday(birthday);
        if (!v.valid) { setBirthdayError(v.error); await showAlert({ title: 'Error', message: v.error, variant: 'warning' }); return false; }
        if (!gender) { await showAlert({ title: 'Required', message: 'Please select your gender', variant: 'warning' }); return false; }
        return true;
      }
      case 'budgetLocation':
        if (!budget || parseInt(budget) < 100) {
          await showAlert({ title: 'Required', message: 'Please enter your maximum monthly budget', variant: 'warning' });
          return false;
        }
        if (!selectedCity) {
          await showAlert({ title: 'Required', message: 'Please select a city', variant: 'warning' });
          return false;
        }
        return true;
      case 'dealbreakers':
        return true;
      case 'sleepCleanliness':
        if (!sleepSchedule) { await showAlert({ title: 'Required', message: 'Please select your sleep schedule', variant: 'warning' }); return false; }
        if (!cleanliness) { await showAlert({ title: 'Required', message: 'Please select your cleanliness style', variant: 'warning' }); return false; }
        return true;
      case 'smokingPets':
        if (!smoking) { await showAlert({ title: 'Required', message: 'Please select your smoking preference', variant: 'warning' }); return false; }
        if (!pets) { await showAlert({ title: 'Required', message: 'Please select your pet preference', variant: 'warning' }); return false; }
        return true;
      case 'lifestyle':
        return true;
      case 'housing':
        if (!lookingFor) { await showAlert({ title: 'Required', message: 'Please select what you are looking for', variant: 'warning' }); return false; }
        if (!moveInDate.trim()) { await showAlert({ title: 'Required', message: 'Please select your move-in date', variant: 'warning' }); return false; }
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
      case 'personality':
        if (Object.keys(personalityAnswers).length < 5) {
          await showAlert({ title: 'Almost done', message: 'Please answer all 5 questions', variant: 'info' });
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
      email: (email.trim() || user?.email || '').toLowerCase(),
      birthday: birthdayStorageFormat,
      zodiacSign,
      photos: photos.length > 0 ? photos : user?.photos,
      profilePicture: photos[0] || user?.profilePicture,
      profileData: {
        bio: bio.trim() || undefined,
        budget: budget.trim() ? parseInt(budget) : undefined,
        budgetMin: budgetMin.trim() ? parseInt(budgetMin) : undefined,
        lookingFor,
        location: selectedNeighborhood || preferredNeighborhoods[0] || selectedCity || location.trim() || undefined,
        neighborhood: selectedNeighborhood || preferredNeighborhoods[0] || undefined,
        city: selectedCity || undefined,
        state: selectedState || undefined,
        coordinates: (selectedNeighborhood || preferredNeighborhoods[0]) ? getCoordinatesFromNeighborhood(selectedNeighborhood || preferredNeighborhoods[0]) || undefined : undefined,
        preferred_neighborhoods: preferredNeighborhoods.length > 0 ? preferredNeighborhoods : undefined,
        zip_code: zipCode.trim() || undefined,
        occupation: occupation.trim() || undefined,
        interests: interests.length > 0 ? interests : undefined,
        gender,
        dealbreakers,
        personalityAnswers: Object.keys(personalityAnswers).length > 0 ? personalityAnswers : undefined,
        profileNote: profileNote.trim() || undefined,
        ideal_roommate_text: idealRoommateTextRef.current.trim() || undefined,
        desired_roommate_count: desiredRoommateCount,
        desired_bedroom_count: desiredBedroomCount,
        household_gender_preference: householdGenderPref,
        pi_auto_match_enabled: piAutoMatchEnabled,
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

    try {
      await updateProfile({
        preferred_neighborhoods: preferredNeighborhoods.length > 0 ? preferredNeighborhoods : undefined,
        zip_code: zipCode.trim() || undefined,
        ideal_roommate_text: idealRoommateTextRef.current.trim() || undefined,
        desired_roommate_count: desiredRoommateCount,
        desired_bedroom_count: desiredBedroomCount,
        household_gender_preference: householdGenderPref,
        pi_auto_match_enabled: piAutoMatchEnabled,
        listing_type_preference: user?.profileData?.listing_type_preference,
        apartment_search_type: user?.profileData?.apartment_search_type,
      });
    } catch (e) {
      console.warn('[ProfileQuestionnaire] Profile sync failed:', e);
    }

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
            {renderSubSectionHeader('Gender *')}
            <EmojiTileGrid
              options={[
                { value: 'male', emoji: '\uD83D\uDE4B\u200D\u2642\uFE0F', label: 'Male' },
                { value: 'female', emoji: '\uD83D\uDE4B\u200D\u2640\uFE0F', label: 'Female' },
                { value: 'other', emoji: '\uD83C\uDF08', label: 'Other' },
              ]}
              selected={gender || ''}
              onSelect={(v) => setGender(v as any)}
            />
          </View>
        );

      case 'budgetLocation':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={styles.questionText}>Monthly rent budget</ThemedText>
            <View style={styles.budgetRangeRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.budgetRangeLabel}>Min</ThemedText>
                <View style={styles.budgetInputRow}>
                  <ThemedText style={styles.budgetPrefix}>$</ThemedText>
                  <TextInput
                    style={styles.budgetRangeInput}
                    placeholder="1,000"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                  />
                </View>
              </View>
              <ThemedText style={styles.budgetRangeSeparator}>to</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.budgetRangeLabel}>Max</ThemedText>
                <View style={styles.budgetInputRow}>
                  <ThemedText style={styles.budgetPrefix}>$</ThemedText>
                  <TextInput
                    style={styles.budgetRangeInput}
                    placeholder="2,500"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    value={budget}
                    onChangeText={setBudget}
                  />
                </View>
              </View>
            </View>

            <ThemedText style={[styles.questionText, { marginTop: 24 }]}>Where are you looking?</ThemedText>
            <LocationPicker
              selectedState={selectedState}
              selectedCity={selectedCity}
              selectedNeighborhood={selectedNeighborhood}
              onStateChange={setSelectedState}
              onCityChange={setSelectedCity}
              onNeighborhoodChange={(n) => {
                setSelectedNeighborhood(n);
                if (n && !preferredNeighborhoods.includes(n) && preferredNeighborhoods.length < 3) {
                  setPreferredNeighborhoods(prev => [...prev, n]);
                }
              }}
            />

            <ThemedText style={[styles.questionText, { marginTop: 20, fontSize: 16 }]}>
              Preferred neighborhoods (pick up to 3)
            </ThemedText>
            <ThemedText style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
              {preferredNeighborhoods.length}/3 selected
            </ThemedText>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {Object.entries(BOROUGH_NEIGHBORHOODS).map(([borough, hoods]) => (
                <View key={borough} style={{ marginBottom: 12 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#ff6b5b', marginBottom: 6 }}>{borough}</ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {hoods.map(hood => {
                      const isSelected = preferredNeighborhoods.includes(hood);
                      return (
                        <Pressable
                          key={hood}
                          style={{
                            backgroundColor: isSelected ? 'rgba(255,107,91,0.15)' : '#1c1c1c',
                            borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11,
                            borderWidth: 1.5, borderColor: isSelected ? '#ff6b5b' : '#2a2a2a',
                          }}
                          onPress={() => {
                            setPreferredNeighborhoods(prev => {
                              if (prev.includes(hood)) return prev.filter(x => x !== hood);
                              if (prev.length >= 3) return prev;
                              return [...prev, hood];
                            });
                          }}
                        >
                          <ThemedText style={{ fontSize: 12, color: isSelected ? '#ff6b5b' : '#ccc' }}>
                            {hood}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <ThemedText style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Zip code (optional)</ThemedText>
              <TextInput
                style={{
                  backgroundColor: '#1c1c1c', borderRadius: 12, borderWidth: 1.5,
                  borderColor: '#2a2a2a', paddingVertical: 12, paddingHorizontal: 14,
                  fontSize: 15, color: '#fff',
                }}
                value={zipCode}
                onChangeText={(t) => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder="10001"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <ThemedText style={[styles.questionText, { marginTop: 24 }]}>What do you do for work?</ThemedText>
            <OccupationBarSelector
              selectedOccupation={occupation}
              onChange={setOccupation}
            />
          </View>
        );

      case 'dealbreakers': {
        const toggleDealbreaker = (value: string) => {
          setDealbreakers(prev =>
            prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
          );
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        };

        return (
          <View style={styles.stepInner}>
            <ThemedText style={styles.dealbreakersHint}>
              These are hard filters \u2014 people who don't match these won't appear in your deck at all.
              Leave blank if you're flexible.
            </ThemedText>
            <CheckboxPills
              options={[
                { value: 'no_smokers', emoji: '\uD83D\uDEAD', label: 'No smokers' },
                { value: 'no_cats', emoji: '\uD83D\uDC08', label: 'No cats' },
                { value: 'no_dogs', emoji: '\uD83D\uDC15', label: 'No dogs' },
                { value: 'no_pets', emoji: '\uD83D\uDC3E', label: 'No pets at all' },
                { value: 'private_bathroom', emoji: '\uD83D\uDEBF', label: 'Private bathroom' },
                { value: 'same_sex_only', emoji: '\uD83D\uDEBB', label: 'Same-sex only' },
                { value: 'no_overnight_guests', emoji: '\uD83D\uDECF\uFE0F', label: 'No overnight guests' },
                { value: 'quiet_hours', emoji: '\uD83E\uDD2B', label: 'Strict quiet hours' },
              ]}
              selected={dealbreakers}
              onToggle={toggleDealbreaker}
            />
            <ThemedText style={styles.dealbreakersFootnote}>
              You can update these anytime in your profile settings.
            </ThemedText>
          </View>
        );
      }

      case 'sleepCleanliness':
        return (
          <View style={styles.stepInner}>
            {renderSubSectionHeader('Sleep Schedule')}
            <EmojiTileGrid
              options={[
                { value: 'early_sleeper', emoji: '🌅', label: 'Early Bird', subtitle: 'Bed by 10pm, up by 7am' },
                { value: 'late_sleeper', emoji: '🦉', label: 'Night Owl', subtitle: 'Bed after midnight, up late' },
                { value: 'flexible', emoji: '😴', label: 'Flexible', subtitle: 'Adjust to roommate' },
                { value: 'irregular', emoji: '🔄', label: 'Shift Worker', subtitle: 'Irregular hours' },
              ]}
              selected={sleepSchedule || ''}
              onSelect={(v) => setSleepSchedule(v as any)}
            />

            <View style={{ height: 28 }} />

            {renderSubSectionHeader('Cleanliness Standard')}
            <IconScale
              levels={[
                { value: 'relaxed', emoji: '😅', label: 'Pretty relaxed — organized chaos is fine' },
                { value: 'moderately_tidy', emoji: '🙂', label: 'Fairly tidy — clean up after myself' },
                { value: 'very_tidy', emoji: '✨', label: 'Very clean — things have a place' },
              ]}
              selected={cleanliness || ''}
              onSelect={(v) => setCleanliness(v as any)}
            />
          </View>
        );

      case 'smokingPets':
        return (
          <View style={styles.stepInner}>
            {renderSubSectionHeader('Smoking')}
            <EmojiTileGrid
              options={[
                { value: 'no', emoji: '🚭', label: 'Non-Smoker', subtitle: "Don't smoke, prefer no smoking" },
                { value: 'only_outside', emoji: '🌿', label: 'Outside Only', subtitle: 'I smoke but only outside' },
                { value: 'yes', emoji: '🚬', label: 'Smoker', subtitle: 'I smoke, roommate should be OK' },
              ]}
              selected={smoking || ''}
              onSelect={(v) => setSmoking(v as any)}
            />

            <View style={{ height: 28 }} />

            {renderSubSectionHeader('Pets')}
            <EmojiTileGrid
              options={[
                { value: 'no_pets', emoji: '🚫', label: 'No Pets', subtitle: "I don't have or want pets" },
                { value: 'have_pets', emoji: '🐾', label: 'I Have Pets', subtitle: 'My pet will live with us' },
                { value: 'open_to_pets', emoji: '😊', label: 'Open to Pets', subtitle: "Fine if roommate has pets" },
              ]}
              selected={pets || ''}
              onSelect={(v) => setPets(v as any)}
            />
          </View>
        );

      case 'lifestyle':
        return (
          <View style={styles.stepInner}>
            {renderSubSectionHeader('Work Style')}
            <EmojiTileGrid
              options={[
                { value: 'office_fulltime', emoji: '\uD83C\uDFE2', label: 'Office', subtitle: 'Out all day' },
                { value: 'wfh_fulltime', emoji: '\uD83D\uDCBB', label: 'Remote', subtitle: 'Home most days' },
                { value: 'hybrid', emoji: '\uD83D\uDD00', label: 'Hybrid', subtitle: 'Mix of both' },
                { value: 'irregular', emoji: '\uD83C\uDF19', label: 'Irregular', subtitle: 'Shift work / varies' },
              ]}
              selected={workLocation || ''}
              onSelect={(v) => setWorkLocation(v as any)}
            />

            <View style={{ height: 28 }} />

            {renderSubSectionHeader('Guests at Home')}
            <EmojiTileGrid
              options={[
                { value: 'prefer_no_guests', emoji: '\uD83C\uDFE0', label: 'No Guests', subtitle: 'Keep the home private' },
                { value: 'rarely', emoji: '\uD83D\uDC4B', label: 'Rarely', subtitle: 'Guests maybe once a month' },
                { value: 'occasionally', emoji: '\uD83D\uDE0A', label: 'Occasionally', subtitle: 'Weekends sometimes' },
                { value: 'frequently', emoji: '\uD83C\uDF89', label: 'Often', subtitle: 'Friends over regularly' },
              ]}
              selected={guestPolicy || ''}
              onSelect={(v) => setGuestPolicy(v as any)}
            />

            <View style={{ height: 28 }} />

            {renderSubSectionHeader('Noise Level')}
            <IconScale
              levels={[
                { value: 'prefer_quiet', emoji: '\uD83E\uDD2B', label: 'Very quiet \u2014 I need near-silence to relax' },
                { value: 'normal_noise', emoji: '\uD83C\uDFB5', label: 'Moderate \u2014 normal household sounds' },
                { value: 'loud_environments', emoji: '\uD83C\uDF89', label: 'Lively \u2014 love an active, buzzy home' },
              ]}
              selected={noiseTolerance || ''}
              onSelect={(v) => setNoiseTolerance(v as any)}
            />
          </View>
        );

      case 'housing':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[styles.inputLabel, { marginBottom: 10 }]}>Looking For</ThemedText>
            <BinaryChoice
              options={[
                { value: 'room', emoji: '\uD83D\uDECF\uFE0F', label: 'A Room' },
                { value: 'entire_apartment', emoji: '\uD83C\uDFE0', label: 'Full Apartment' },
              ]}
              selected={lookingFor || ''}
              onSelect={(v) => setLookingFor(v as any)}
            />

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

            {lookingFor !== 'entire_apartment' ? (
              <>
                <ThemedText style={[styles.inputLabel, { marginBottom: 10, marginTop: 4 }]}>Private Bathroom</ThemedText>
                <BinaryChoice
                  options={[
                    { value: 'yes', emoji: '\uD83D\uDEBF', label: 'Private' },
                    { value: 'no', emoji: '\uD83D\uDC65', label: 'Shared is fine' },
                  ]}
                  selected={privateBathroom === true ? 'yes' : privateBathroom === false ? 'no' : ''}
                  onSelect={(v) => setPrivateBathroom(v === 'yes')}
                />
              </>
            ) : null}
          </View>
        );

      case 'roommateSetup':
        return (
          <View style={styles.stepInner}>
            <ThemedText style={[styles.inputLabel, { marginBottom: 10 }]}>How many roommates?</ThemedText>
            <EmojiTileGrid
              options={[
                { value: '0', emoji: '\uD83C\uDF1F', label: 'No Preference', subtitle: 'Open to any size' },
                { value: '1', emoji: '\uD83D\uDC64', label: '1 Roommate', subtitle: '2 people total' },
                { value: '2', emoji: '\uD83D\uDC65', label: '2 Roommates', subtitle: '3 people total' },
                { value: '3', emoji: '\uD83D\uDC6A', label: '3 Roommates', subtitle: '4 people total' },
                { value: '4', emoji: '\uD83C\uDFE0', label: '4+ Roommates', subtitle: '5+ people total' },
              ]}
              selected={String(desiredRoommateCount)}
              onSelect={(v) => setDesiredRoommateCount(parseInt(v))}
            />

            <View style={{ height: 28 }} />

            <ThemedText style={[styles.inputLabel, { marginBottom: 10 }]}>How many bedrooms?</ThemedText>
            <EmojiTileGrid
              options={[
                { value: '0', emoji: '\uD83C\uDF1F', label: 'No Preference', subtitle: 'Open to any' },
                { value: '1', emoji: '\uD83D\uDECF\uFE0F', label: '1 Bedroom' },
                { value: '2', emoji: '\uD83D\uDECF\uFE0F', label: '2 Bedrooms' },
                { value: '3', emoji: '\uD83D\uDECF\uFE0F', label: '3 Bedrooms' },
                { value: '4', emoji: '\uD83D\uDECF\uFE0F', label: '4+ Bedrooms' },
              ]}
              selected={String(desiredBedroomCount)}
              onSelect={(v) => setDesiredBedroomCount(parseInt(v))}
            />

            <View style={{ height: 28 }} />

            <ThemedText style={[styles.inputLabel, { marginBottom: 10 }]}>Household gender preference</ThemedText>
            <EmojiTileGrid
              options={[
                { value: 'any', emoji: '\uD83C\uDF0D', label: 'No Preference', subtitle: 'Open to anyone' },
                { value: 'male_only', emoji: '\uD83D\uDC68', label: 'Male Only' },
                { value: 'female_only', emoji: '\uD83D\uDC69', label: 'Female Only' },
                { value: 'same_gender', emoji: '\uD83E\uDD1D', label: 'Same Gender', subtitle: 'Match my gender' },
              ]}
              selected={householdGenderPref}
              onSelect={(v) => setHouseholdGenderPref(v as 'any' | 'male_only' | 'female_only' | 'same_gender')}
            />

            <View style={{ height: 28 }} />

            <Pressable
              onPress={() => setPiAutoMatchEnabled(!piAutoMatchEnabled)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: piAutoMatchEnabled ? theme.primary + '20' : theme.backgroundSecondary,
                borderWidth: 2,
                borderColor: piAutoMatchEnabled ? theme.primary : theme.border,
                borderRadius: 14,
                gap: 12,
              }}
            >
              <Feather name={piAutoMatchEnabled ? 'check-circle' : 'circle'} size={22} color={piAutoMatchEnabled ? theme.primary : theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 15, fontWeight: '600', color: piAutoMatchEnabled ? theme.primary : theme.text }}>
                  Pi Auto-Match
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                  Let Pi automatically find compatible roommates for you
                </ThemedText>
              </View>
            </Pressable>
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

      case 'personality': {
        const PERSONALITY_QUESTIONS = [
          {
            id: 'q1',
            question: 'When you get home after a long day:',
            options: [
              { value: 'alone', emoji: '\uD83D\uDECB\uFE0F', label: 'Decompress alone quietly' },
              { value: 'music', emoji: '\uD83C\uDFB5', label: 'Put on music and unwind' },
              { value: 'social', emoji: '\uD83D\uDCF1', label: 'Call friends or catch up' },
              { value: 'kitchen', emoji: '\uD83C\uDF73', label: 'Cook and relax in the kitchen' },
            ],
          },
          {
            id: 'q2',
            question: 'How do you want to handle issues with a roommate?',
            options: [
              { value: 'text', emoji: '\uD83D\uDCAC', label: 'Text \u2014 keeps things low pressure' },
              { value: 'direct', emoji: '\uD83D\uDDE3\uFE0F', label: 'Face to face, direct and clear' },
              { value: 'meeting', emoji: '\uD83D\uDCCB', label: 'Sit down together and talk it out' },
              { value: 'flow', emoji: '\uD83D\uDE0E', label: 'Go with the flow, no drama' },
            ],
          },
          {
            id: 'q3',
            question: 'The kitchen after cooking:',
            options: [
              { value: 'immediate', emoji: '\uD83E\uDDFC', label: 'Cleaned up immediately every time' },
              { value: 'sameday', emoji: '\uD83D\uDD50', label: 'Cleaned before the end of the day' },
              { value: 'nextday', emoji: '\uD83D\uDE34', label: 'Sometimes the next morning is fine' },
              { value: 'flexible', emoji: '\uD83E\uDD37', label: "Doesn't bother me either way" },
            ],
          },
          {
            id: 'q4',
            question: 'What kind of roommate relationship do you want?',
            options: [
              { value: 'friends', emoji: '\uD83E\uDD1D', label: 'Actual friends \u2014 hang out together' },
              { value: 'friendly', emoji: '\uD83D\uDC4B', label: 'Friendly but independent lives' },
              { value: 'respectful', emoji: '\uD83C\uDFE0', label: 'Respectful co-living, minimal interaction' },
              { value: 'parallel', emoji: '\uD83D\uDEB6', label: 'Ships passing \u2014 barely see each other' },
            ],
          },
          {
            id: 'q5',
            question: 'How far can you realistically commute from home?',
            options: [
              { value: 'under_20', emoji: '\uD83D\uDEB6', label: 'Under 20 minutes' },
              { value: 'under_40', emoji: '\uD83D\uDE87', label: 'Up to 40 minutes' },
              { value: 'under_60', emoji: '\u23F1\uFE0F', label: 'Up to an hour' },
              { value: 'flexible', emoji: '\uD83D\uDDFA\uFE0F', label: "Flexible \u2014 I work remotely or don't mind" },
            ],
          },
        ];

        return (
          <View style={styles.stepInner}>
            {PERSONALITY_QUESTIONS.map((q) => (
              <View key={q.id} style={{ marginBottom: 24 }}>
                <ThemedText style={styles.questionText}>{q.question}</ThemedText>
                <EmojiTileGrid
                  options={q.options}
                  selected={personalityAnswers[q.id] || ''}
                  onSelect={(value) => setPersonalityAnswers(prev => ({ ...prev, [q.id]: value }))}
                />
              </View>
            ))}
          </View>
        );
      }

      case 'profileNote': {
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Feather name="edit-3" size={28} color={theme.primary} />
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                In your own words
              </Text>
              <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
                Write anything you want potential roommates to know about you — your habits, your vibe, what makes you a great roommate. This shows on your profile and helps our AI answer questions about you honestly.
              </Text>
            </View>

            <View style={{
              backgroundColor: theme.backgroundSecondary,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: profileNote.length > 0 ? theme.primary : theme.border,
              padding: 16,
            }}>
              <TextInput
                style={{
                  color: theme.text,
                  fontSize: 16,
                  lineHeight: 24,
                  minHeight: 140,
                  textAlignVertical: 'top',
                }}
                value={profileNote}
                onChangeText={(text) => setProfileNote(text.slice(0, profileNoteCharLimit))}
                placeholder="e.g. I work from home so I'm around a lot during the day, but I wear headphones and stay in my room. I love to cook and always make extra. Very clean in shared spaces. Looking for someone chill who doesn't need a social roommate but is friendly when we cross paths."
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={profileNoteCharLimit}
              />
              <Text style={{
                color: profileNote.length > profileNoteCharLimit * 0.9 ? '#ef4444' : theme.textSecondary,
                fontSize: 12,
                textAlign: 'right',
                marginTop: 8,
              }}>
                {profileNote.length}/{profileNoteCharLimit}
              </Text>
            </View>

            <View style={{
              flexDirection: 'row',
              gap: 10,
              padding: 14,
              backgroundColor: theme.primary + '10',
              borderRadius: 14,
              marginTop: 12,
            }}>
              <Feather name="zap" size={16} color={theme.primary} />
              <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>
                When someone asks Rhome AI about you, it reads this note to give them a real answer — not just your checklist. You control exactly what it says.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => goNext()}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                Skip for now
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'idealRoommate': {
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Feather name="cpu" size={28} color="#a855f7" />
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                Your ideal roommate
              </Text>
              <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
                Describe your perfect roommate in your own words. Pi, our AI matchmaker, reads this to find people who actually fit what you're looking for — beyond just checkboxes.
              </Text>
            </View>

            <View style={{
              backgroundColor: theme.backgroundSecondary,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: idealRoommateText.length > 0 ? '#a855f7' : theme.border,
              padding: 16,
            }}>
              <TextInput
                style={{
                  color: theme.text,
                  fontSize: 16,
                  lineHeight: 24,
                  minHeight: 140,
                  textAlignVertical: 'top',
                }}
                value={idealRoommateText}
                onChangeText={(text) => setIdealRoommateText(text.slice(0, idealRoommateCharLimit))}
                placeholder="e.g. Someone who's clean but not uptight about it. Ideally works a 9-5 so we're on similar schedules. I'd love a roommate who's down to grab dinner sometimes but also totally fine doing their own thing. No heavy partiers please — I'm an early riser."
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={idealRoommateCharLimit}
              />
              <Text style={{
                color: idealRoommateText.length > idealRoommateCharLimit * 0.9 ? '#ef4444' : theme.textSecondary,
                fontSize: 12,
                textAlign: 'right',
                marginTop: 8,
              }}>
                {idealRoommateText.length}/{idealRoommateCharLimit}
              </Text>
            </View>

            <View style={{
              flexDirection: 'row',
              gap: 10,
              padding: 14,
              backgroundColor: 'rgba(168,85,247,0.08)',
              borderRadius: 14,
              marginTop: 12,
            }}>
              <Feather name="cpu" size={16} color="#a855f7" />
              <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>
                Pi reads this to understand what matters to you beyond the standard filters. The more specific you are, the better your matches.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                const isLastStep = currentFilteredIndex >= stepsToShow.length - 1;
                if (isLastStep) {
                  handleSave();
                } else {
                  goNext();
                }
              }}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                Skip for now
              </Text>
            </TouchableOpacity>
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
  budgetRangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 8,
  },
  budgetRangeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  budgetRangeInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  budgetRangeSeparator: {
    color: '#888',
    marginBottom: 16,
  },
  dealbreakersHint: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 20,
  },
  dealbreakersFootnote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
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
