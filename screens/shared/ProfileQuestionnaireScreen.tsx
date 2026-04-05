import React, { useState, useEffect, useCallback } from 'react';
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
  Dimensions,
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
  withSpring,
  withRepeat,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight,
  BounceIn,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
import { AppHeader } from '../../components/AppHeader';
import { RhomeLogo } from '../../components/RhomeLogo';

const SCREEN_WIDTH = Dimensions.get('window').width;

type StepId =
  | 'photos'
  | 'basicInfo'
  | 'budgetLocation'
  | 'dealbreakers'
  | 'houseRules'
  | 'lifestyle'
  | 'yourSetup'
  | 'interests'
  | 'personality'
  | 'finalWords';

const STEP_ORDER: StepId[] = [
  'photos',
  'basicInfo',
  'budgetLocation',
  'dealbreakers',
  'houseRules',
  'lifestyle',
  'yourSetup',
  'interests',
  'personality',
  'finalWords',
];

const ONBOARDING_STEPS: StepId[] = [
  'photos',
  'basicInfo',
  'budgetLocation',
];

const ONBOARDING_STEPS_LITE: StepId[] = [
  'photos',
  'basicInfo',
];

const PLACE_SEEKER_STEPS: StepId[] = [
  'photos',
  'basicInfo',
];

const LEGACY_STEP_MAP: Record<string, StepId> = {
  sleepCleanliness: 'houseRules',
  smokingPets: 'houseRules',
  housing: 'yourSetup',
  roommateSetup: 'yourSetup',
  profileNote: 'finalWords',
  idealRoommate: 'finalWords',
};

const STEP_TITLES: Record<StepId, string> = {
  photos: 'First impressions matter',
  basicInfo: "Let's get to know you",
  budgetLocation: "What's the plan?",
  dealbreakers: "What's a dealbreaker?",
  houseRules: 'The make-or-break stuff',
  lifestyle: 'A day in your life',
  yourSetup: 'Build your crew',
  interests: 'What makes you, you?',
  personality: 'Living with you',
  finalWords: 'Almost done!',
};

const STEP_SUBTITLES: Record<StepId, string> = {
  photos: 'Roommates want to know who they\'ll be living with. Add at least one photo.',
  basicInfo: 'Just the essentials \u2014 takes 30 seconds',
  budgetLocation: 'Budget and location \u2014 the two things that matter most',
  dealbreakers: 'These are non-negotiable. We\'ll filter out anyone who doesn\'t fit.',
  houseRules: 'Sleep and cleanliness cause 80% of roommate conflicts. Be honest.',
  lifestyle: 'How do you actually spend your time at home?',
  yourSetup: 'What kind of household are you looking for?',
  interests: 'Pick what resonates. This helps roommates see if you\'d vibe.',
  personality: 'Five quick scenarios. Pick what feels most like you.',
  finalWords: 'Tell us about yourself and your ideal roommate in your own words.',
};

const PLACE_SEEKER_TITLES: Partial<Record<StepId, string>> = {
  finalWords: 'In Your Own Words',
};

const PLACE_SEEKER_SUBTITLES: Partial<Record<StepId, string>> = {
  interests: 'Pick at least 1 tag from each category.',
  finalWords: 'Write anything you want others to know about you.',
};

const STEP_ICONS: Record<StepId, keyof typeof Feather.glyphMap> = {
  photos: 'camera',
  basicInfo: 'user',
  budgetLocation: 'dollar-sign',
  dealbreakers: 'shield',
  houseRules: 'home',
  lifestyle: 'users',
  yourSetup: 'layout',
  interests: 'star',
  personality: 'cpu',
  finalWords: 'edit-3',
};

const STEP_ACCENT_COLORS: Record<StepId, string[]> = {
  photos: ['rgba(255,107,91,0.10)', 'rgba(255,107,91,0)'],
  basicInfo: ['rgba(108,92,231,0.10)', 'rgba(108,92,231,0)'],
  budgetLocation: ['rgba(39,174,96,0.10)', 'rgba(39,174,96,0)'],
  dealbreakers: ['rgba(231,76,60,0.10)', 'rgba(231,76,60,0)'],
  houseRules: ['rgba(52,152,219,0.10)', 'rgba(52,152,219,0)'],
  lifestyle: ['rgba(168,85,247,0.10)', 'rgba(168,85,247,0)'],
  yourSetup: ['rgba(46,204,113,0.10)', 'rgba(46,204,113,0)'],
  interests: ['rgba(241,196,15,0.10)', 'rgba(241,196,15,0)'],
  personality: ['rgba(155,89,182,0.10)', 'rgba(155,89,182,0)'],
  finalWords: ['rgba(52,152,219,0.10)', 'rgba(52,152,219,0)'],
};

const BIO_PLACEHOLDERS = [
  "I'm a software engineer who loves cooking...",
  "Film student, big coffee person, clean freak...",
  "Night owl, gym rat, always down for takeout...",
  "Teacher by day, gamer by night. Quiet but friendly...",
  "Dog mom, WFH, love a clean kitchen...",
];

const PROFILE_NOTE_SNIPPETS = [
  { label: 'I work from home', text: "I work from home so I'm around during the day, but I keep to myself and wear headphones." },
  { label: "I'm pretty quiet", text: "I'm on the quieter side. I like peaceful evenings and keeping shared spaces clean." },
  { label: 'I love cooking', text: "I love cooking and always make extra. Happy to share meals with a roommate who appreciates good food." },
  { label: 'Looking for friends', text: "Looking for roommates who could become actual friends, not just people who split rent." },
];

const IDEAL_SNIPPETS = [
  { label: 'Clean and quiet', text: "Someone who's clean but not uptight about it. Keeps shared spaces tidy." },
  { label: 'Social and outgoing', text: "A social person who loves going out. Someone who's down for weekend plans." },
  { label: 'Remote worker', text: "Another remote worker on a similar schedule. WFH buddies who respect focus time." },
  { label: 'Chill vibes', text: "Someone laid back and easygoing. Low drama, good energy." },
];

function generateVibeSummary(selectedInterests: string[]): string {
  if (selectedInterests.length < 3) return '';
  const vibes: string[] = [];
  const has = (s: string) => selectedInterests.some(i => i.toLowerCase().includes(s.toLowerCase()));
  if (has('Early Bird') && has('Fitness')) vibes.push('morning wellness');
  if (has('Night Owl') && has('Gaming')) vibes.push('late-night gaming');
  if (has('Cooking') && has('Foodie')) vibes.push('kitchen enthusiast');
  if (has('Introvert') && has('Reading')) vibes.push('quiet bookworm');
  if (has('Social') && has('Host')) vibes.push('social host');
  if (has('Minimalist') && has('Clean')) vibes.push('tidy minimalist');
  if (has('Plant')) vibes.push('green thumb');
  if (has('Music')) vibes.push('music lover');
  if (has('Travel')) vibes.push('wanderlust');
  if (vibes.length === 0) return `${selectedInterests.length} interests selected`;
  return `You're giving ${vibes.join(' + ')} energy`;
}

function SelectionCard({
  icon,
  label,
  subtitle,
  selected,
  onPress,
  accentColor = '#ff6b5b',
  danger = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
  danger?: boolean;
}) {
  const borderColor = danger
    ? (selected ? '#E74C3C' : '#2a2a2a')
    : (selected ? accentColor : '#2a2a2a');
  const bgColor = danger
    ? (selected ? 'rgba(231,76,60,0.08)' : '#1a1a1a')
    : (selected ? accentColor + '12' : '#1a1a1a');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.selectionCard, { borderColor, backgroundColor: bgColor }]}
    >
      <View style={[styles.selectionCardIcon, { backgroundColor: (danger && selected ? '#E74C3C' : accentColor) + '15' }]}>
        <Feather name={icon} size={20} color={danger && selected ? '#E74C3C' : (selected ? accentColor : 'rgba(255,255,255,0.5)')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectionCardLabel, selected ? { color: danger ? '#E74C3C' : accentColor } : null]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.selectionCardSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {selected ? (
        <Feather name="check-circle" size={18} color={danger ? '#E74C3C' : accentColor} />
      ) : null}
    </Pressable>
  );
}

function OptionCard({
  icon,
  label,
  subtitle,
  selected,
  onPress,
  accentColor = '#ff6b5b',
  wide = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionCard,
        wide ? { width: '100%' } : { width: '47%' },
        selected ? { borderColor: accentColor, backgroundColor: accentColor + '12' } : null,
      ]}
    >
      <View style={[styles.optionCardIconWrap, { backgroundColor: accentColor + '15' }]}>
        <Feather name={icon} size={22} color={selected ? accentColor : 'rgba(255,255,255,0.5)'} />
      </View>
      <Text style={[styles.optionCardLabel, selected ? { color: accentColor } : null]}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={styles.optionCardSubtitle}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

function ScaleSelector({
  levels,
  selected,
  onSelect,
  accentColor = '#ff6b5b',
}: {
  levels: { value: string; icon: keyof typeof Feather.glyphMap; label: string; desc?: string }[];
  selected: string;
  onSelect: (v: string) => void;
  accentColor?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {levels.map((level) => {
        const active = selected === level.value;
        return (
          <Pressable
            key={level.value}
            onPress={() => onSelect(level.value)}
            style={[
              styles.scaleItem,
              active ? { borderColor: accentColor, backgroundColor: accentColor + '10' } : null,
            ]}
          >
            <View style={[styles.scaleIcon, { backgroundColor: accentColor + '15' }]}>
              <Feather name={level.icon} size={18} color={active ? accentColor : 'rgba(255,255,255,0.4)'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scaleLabel, active ? { color: accentColor } : null]}>{level.label}</Text>
              {level.desc ? <Text style={styles.scaleDesc}>{level.desc}</Text> : null}
            </View>
            {active ? <Feather name="check" size={16} color={accentColor} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function MilestoneToast({ text }: { text: string }) {
  return (
    <Animated.View entering={BounceIn.duration(400)} style={styles.milestoneToast}>
      <LinearGradient
        colors={['rgba(255,107,91,0.15)', 'rgba(168,85,247,0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.milestoneGradient}
      >
        <Feather name="award" size={16} color="#ff6b5b" />
        <Text style={styles.milestoneText}>{text}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

export const ProfileQuestionnaireScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser, completeOnboardingStep, logout, abandonSignup } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const isOnboarding = user?.onboardingStep === 'profile';
  const searchType = user?.profileData?.apartment_search_type;
  const isPlaceSeekerUser = !!searchType && searchType !== 'with_roommates';
  const isLiteOnboarding = isOnboarding && user?.role === 'renter' && (
    searchType === 'solo' || searchType === 'with_partner'
  );
  const missingStepsParam = (route.params as any)?.missingSteps as string[] | undefined;
  const allStepsForType = isPlaceSeekerUser ? PLACE_SEEKER_STEPS : STEP_ORDER;

  const shouldSkipStep = (stepName: StepId): boolean => {
    if (!user) return false;
    const pd = user.profileData || {};
    const prefs = pd.preferences || {};
    switch (stepName) {
      case 'photos':
        return (Array.isArray(user.photos) && user.photos.length > 0) || !!user.profile_picture;
      case 'budgetLocation':
        return !!((pd.budget || pd.budgetMin || pd.budgetMax) && (pd.city || user.city));
      case 'houseRules':
        return !!(prefs.sleepSchedule && prefs.cleanliness && prefs.smoking && prefs.pets);
      case 'dealbreakers':
        return Array.isArray(pd.dealbreakers) && pd.dealbreakers.length > 0;
      case 'yourSetup':
        return isPlaceSeekerUser || !!(prefs.moveInDate || user.moveInTimeline || pd.lookingFor);
      case 'finalWords':
        return !!((pd.ideal_roommate_text || user.ideal_roommate_text)?.trim()?.length >= 10);
      case 'lifestyle':
        if (isPlaceSeekerUser) return true;
        return !!(prefs.workLocation && prefs.guestPolicy && prefs.noiseTolerance);
      case 'interests':
        if (isPlaceSeekerUser) return true;
        return false;
      case 'personality':
        return false;
      default:
        return false;
    }
  };

  const filteredSteps = React.useMemo(() => {
    if (missingStepsParam?.length) {
      const mapped = missingStepsParam.map(s => LEGACY_STEP_MAP[s] || s).filter(s => allStepsForType.includes(s as StepId));
      return [...new Set(mapped)] as StepId[];
    }
    return null;
  }, []);
  const isMissingMode = !!filteredSteps;
  const isHostUser = user?.role === 'host';
  const isHostProfessional = isHostUser && (user?.hostType === 'agent' || user?.hostType === 'company');
  const HOST_EXCLUDED_STEPS: StepId[] = isHostProfessional
    ? ['photos', 'budgetLocation', 'dealbreakers', 'houseRules', 'yourSetup', 'finalWords', 'lifestyle', 'interests', 'personality']
    : ['budgetLocation', 'dealbreakers', 'houseRules', 'yourSetup', 'finalWords'];
  const autoFilteredSteps = React.useMemo(() => {
    if (filteredSteps || isOnboarding) return null;
    let steps = allStepsForType.filter(s => !shouldSkipStep(s));
    if (isHostUser) {
      steps = steps.filter(s => !HOST_EXCLUDED_STEPS.includes(s));
    }
    return steps;
  }, [allStepsForType, user, isHostUser]);
  const renterOnboarding = isOnboarding && user?.role === 'renter';
  const baseOnboardingSteps = isLiteOnboarding ? ONBOARDING_STEPS_LITE : isOnboarding ? ONBOARDING_STEPS : allStepsForType;
  const onboardingSteps = isHostProfessional
    ? baseOnboardingSteps.filter(s => !HOST_EXCLUDED_STEPS.includes(s))
    : (renterOnboarding || isHostUser)
      ? baseOnboardingSteps.filter(s => s !== 'budgetLocation' && s !== 'yourSetup')
      : baseOnboardingSteps;
  const stepsToShow = filteredSteps || autoFilteredSteps || onboardingSteps;
  const [currentFilteredIndex, setCurrentFilteredIndex] = useState(0);
  const useFilteredMapping = isMissingMode || isOnboarding || isPlaceSeekerUser || !!autoFilteredSteps;

  useEffect(() => {
    if (currentFilteredIndex >= stepsToShow.length && stepsToShow.length > 0) {
      setCurrentFilteredIndex(stepsToShow.length - 1);
    }
  }, [stepsToShow.length]);

  const currentStepId = stepsToShow[Math.min(currentFilteredIndex, stepsToShow.length - 1)];
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [photos, setPhotos] = useState<string[]>(user?.photos || (user?.profilePicture ? [user.profilePicture] : []));
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [licenseNumber, setLicenseNumber] = useState(user?.licenseNumber || '');
  const [agencyName, setAgencyName] = useState(user?.agencyName || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [licensePhoto, setLicensePhoto] = useState<string | null>(user?.licenseDocumentUrl || null);
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [brokerageLicense, setBrokerageLicense] = useState(user?.brokerageLicense || user?.profileData?.brokerageLicense || '');
  const [birthdayError, setBirthdayError] = useState('');
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [budget, setBudget] = useState(user?.profileData?.budget?.toString() || '');
  const [lookingFor, setLookingFor] = useState<'room' | 'entire_apartment' | undefined>(user?.profileData?.lookingFor);
  const [location, setLocation] = useState(user?.profileData?.location || '');
  const [selectedState, setSelectedState] = useState(user?.profileData?.state || '');
  const [selectedCity, setSelectedCity] = useState(user?.profileData?.city || '');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(user?.profileData?.neighborhood || '');
  const [preferredNeighborhoods, setPreferredNeighborhoods] = useState<string[]>(
    user?.preferredNeighborhoods || user?.profileData?.preferred_neighborhoods || []
  );
  const [neighborhoodDropdownOpen, setNeighborhoodDropdownOpen] = useState(false);
  const [expandedBoroughs, setExpandedBoroughs] = useState<string[]>([]);
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

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    if (currentStepId !== 'basicInfo') return;
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % BIO_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStepId]);

  useEffect(() => {
    if (user?.photos && user.photos.length > 0) {
      setPhotos(user.photos);
    } else if (user?.profilePicture) {
      setPhotos([user.profilePicture]);
    }
  }, [user?.photos, user?.profilePicture]);

  const pulse = useSharedValue(1);
  const isStepValid = React.useMemo(() => {
    switch (currentStepId) {
      case 'photos': return photos.length > 0;
      case 'basicInfo': return name.trim().length > 0 && email.trim().length > 0 && bio.trim().length >= 20 && (isHostProfessional || (birthday.trim().length > 0 && !!gender));
      case 'budgetLocation': return !!budget && parseInt(budget) >= 100 && !!selectedCity;
      case 'dealbreakers': return true;
      case 'houseRules': return !!sleepSchedule && !!cleanliness && !!smoking && !!pets;
      case 'lifestyle': return true;
      case 'yourSetup': return !!lookingFor && moveInDate.trim().length > 0;
      case 'interests': return interests.length >= 3;
      case 'personality': return Object.keys(personalityAnswers).length >= 5;
      case 'finalWords': return true;
      default: return true;
    }
  }, [currentStepId, photos, name, email, bio, birthday, gender, budget, selectedCity, sleepSchedule, cleanliness, smoking, pets, lookingFor, moveInDate, interests, personalityAnswers, isHostProfessional]);

  useEffect(() => {
    if (isStepValid) {
      pulse.value = withRepeat(
        withSequence(
          withSpring(1.02, { damping: 4, stiffness: 80 }),
          withSpring(1, { damping: 4, stiffness: 80 })
        ),
        2,
        false
      );
    } else {
      pulse.value = 1;
    }
  }, [isStepValid]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

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
    switch (currentStepId) {
      case 'photos':
        if (photos.length === 0) { await showAlert({ title: 'Required', message: 'Please add at least one photo', variant: 'warning' }); return false; }
        return true;
      case 'basicInfo': {
        if (!name.trim()) {
          const nameLabel = isHostProfessional ? (user?.hostType === 'company' ? 'company name' : 'agency name') : 'name';
          await showAlert({ title: 'Required', message: `Please enter your ${nameLabel}`, variant: 'warning' });
          return false;
        }
        if (!email.trim()) { await showAlert({ title: 'Required', message: 'Please enter your email', variant: 'warning' }); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) { await showAlert({ title: 'Error', message: 'Please enter a valid email', variant: 'warning' }); return false; }
        if (!isHostProfessional) {
          if (!birthday.trim()) { await showAlert({ title: 'Required', message: 'Please enter your date of birth', variant: 'warning' }); return false; }
          const v = validateBirthday(birthday);
          if (!v.valid) { setBirthdayError(v.error); await showAlert({ title: 'Error', message: v.error, variant: 'warning' }); return false; }
          if (!gender) { await showAlert({ title: 'Required', message: 'Please select your gender', variant: 'warning' }); return false; }
        }
        const bioLabel = isHostProfessional ? 'about your company' : 'about yourself';
        if (bio.trim().length < 20) { await showAlert({ title: 'Required', message: `Please write at least 20 characters ${bioLabel}`, variant: 'warning' }); return false; }
        return true;
      }
      case 'budgetLocation': {
        const budgetMaxNum = parseInt(budget) || 0;
        const budgetMinNum = parseInt(budgetMin) || 0;
        if (budgetMaxNum < 100) {
          await showAlert({ title: 'Required', message: 'Please set a maximum budget of at least $100', variant: 'warning' });
          return false;
        }
        if (budgetMinNum > budgetMaxNum) {
          await showAlert({ title: 'Budget Range', message: 'Minimum budget cannot be higher than maximum', variant: 'warning' });
          return false;
        }
        if (!selectedCity) {
          await showAlert({ title: 'Required', message: 'Please select a city', variant: 'warning' });
          return false;
        }
        return true;
      }
      case 'dealbreakers':
        return true;
      case 'houseRules':
        if (!sleepSchedule) { await showAlert({ title: 'Required', message: 'Please select your sleep schedule', variant: 'warning' }); return false; }
        if (!cleanliness) { await showAlert({ title: 'Required', message: 'Please select your cleanliness style', variant: 'warning' }); return false; }
        if (!smoking) { await showAlert({ title: 'Required', message: 'Please select your smoking preference', variant: 'warning' }); return false; }
        if (!pets) { await showAlert({ title: 'Required', message: 'Please select your pet preference', variant: 'warning' }); return false; }
        return true;
      case 'yourSetup':
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
      ...(isHostProfessional ? {
        licenseNumber: licenseNumber.trim() || undefined,
        agencyName: agencyName.trim() || undefined,
        licenseDocumentUrl: licensePhoto || undefined,
        brokerageLicense: brokerageLicense.trim() || undefined,
        companyName: companyName.trim() || undefined,
      } : {}),
      preferredNeighborhoods: preferredNeighborhoods.length > 0 ? preferredNeighborhoods : undefined,
      profileData: {
        ...user?.profileData,
        bio: bio.trim() || undefined,
        ...(isHostProfessional ? { brokerageLicense: brokerageLicense.trim() || undefined } : {}),
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

  const showMilestone = (text: string) => {
    setMilestone(text);
    setTimeout(() => setMilestone(null), 2500);
  };

  const goNext = async () => {
    if (!(await validateCurrentStep())) return;
    if (currentFilteredIndex < stepsToShow.length - 1) {
      setDirection('forward');
      const nextIdx = currentFilteredIndex + 1;
      setCurrentFilteredIndex(nextIdx);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      updateUser(buildProfileData()).catch(() => {});

      try {
        if (user?.id) {
          const partialData = buildProfileData();
          updateProfile(user.id, {
            preferred_neighborhoods: preferredNeighborhoods.length > 0 ? preferredNeighborhoods : undefined,
            zip_code: zipCode.trim() || undefined,
            listing_type_preference: user?.profileData?.listing_type_preference,
            apartment_search_type: user?.profileData?.apartment_search_type,
          }).catch(err => console.warn('[Onboarding] Auto-save failed:', err));
        }
      } catch (_) {}

      if (currentStepId === 'photos' && photos.length > 0) {
        showMilestone('Looking good! Let\'s keep going');
      } else if (currentStepId === 'budgetLocation') {
        showMilestone('Great \u2014 we\'ll find listings in your range');
      } else if (nextIdx === Math.floor(stepsToShow.length / 2)) {
        showMilestone('Halfway there! Your profile is taking shape');
      } else if (currentStepId === 'interests') {
        showMilestone('Your roommate profile is looking great!');
      }
    }
  };

  const goBack = async () => {
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

    const safetyTimeout = setTimeout(() => {
      setIsSaving(false);
      showAlert({ title: 'Timed Out', message: 'Saving is taking too long. Please check your connection and try again.', variant: 'warning' });
    }, 30000);

    try {
      await updateUser(buildProfileData());
    } catch (e) {
      console.warn('[ProfileQuestionnaire] updateUser failed:', e);
      clearTimeout(safetyTimeout);
      setIsSaving(false);
      await showAlert({ title: 'Error', message: 'Failed to save your profile. Please try again.', variant: 'warning' });
      return;
    }

    try {
      await updateProfile(user!.id, {
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

    clearTimeout(safetyTimeout);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setIsSaving(false);
    if (user?.onboardingStep === 'profile') {
      const nextStep = user?.role === 'host'
        ? (user?.hostType ? 'plan' : 'hostType')
        : 'plan';
      await completeOnboardingStep(nextStep);
    } else {
      navigation.goBack();
    }
  };

  const isLastStep = currentFilteredIndex === stepsToShow.length - 1;

  const renderSectionLabel = (label: string) => (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabelText}>{label}</Text>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStepId) {
      case 'photos':
        return (
          <View style={styles.stepInner}>
            <Pressable style={styles.mainPhotoSlot} onPress={pickImage}>
              {photos[0] ? (
                <Animated.View entering={ZoomIn.duration(300)} style={{ width: '100%', height: '100%' }}>
                  <Image source={{ uri: photos[0] }} style={{ width: '100%', height: '100%', borderRadius: 18 }} contentFit="cover" />
                  <View style={styles.mainRibbon}>
                    <Text style={styles.mainRibbonText}>Main</Text>
                  </View>
                  <Pressable style={styles.removeBtn} onPress={() => setPhotos(photos.filter((_, i) => i !== 0))}>
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </Animated.View>
              ) : (
                <View style={styles.mainPhotoEmpty}>
                  <Animated.View entering={BounceIn.delay(200)}>
                    <View style={styles.cameraIconWrap}>
                      <Feather name="camera" size={28} color="rgba(255,107,91,0.6)" />
                    </View>
                  </Animated.View>
                  <Text style={styles.addPhotoLabel}>Tap to add your main photo</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.secondaryGrid}>
              {[1, 2, 3, 4, 5].map((idx) => (
                <Pressable
                  key={idx}
                  style={styles.secondarySlot}
                  onPress={() => photos[idx] ? setPhotos(photos.filter((_, i) => i !== idx)) : pickImage()}
                >
                  {photos[idx] ? (
                    <View style={{ width: '100%', height: '100%' }}>
                      <Image source={{ uri: photos[idx] }} style={{ width: '100%', height: '100%', borderRadius: 12 }} contentFit="cover" />
                      <Pressable style={[styles.removeBtn, { width: 22, height: 22, top: 4, right: 4 }]} onPress={() => setPhotos(photos.filter((_, i) => i !== idx))}>
                        <Feather name="x" size={11} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <Feather name="plus" size={18} color="rgba(255,255,255,0.2)" />
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={styles.photoHint}>{photos.length}/6 photos added</Text>
          </View>
        );

      case 'basicInfo':
        return (
          <View style={styles.stepInner}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{isHostProfessional ? (user?.hostType === 'company' ? 'Company Name *' : 'Name *') : 'Name *'}</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
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
            {!isHostProfessional ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Date of Birth *</Text>
                  <Pressable
                    style={[styles.dateTrigger, birthdayError ? { borderColor: '#ef4444' } : null]}
                    onPress={() => setShowBirthdayPicker(true)}
                  >
                    <Feather name="calendar" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 12 }} />
                    <Text style={{ color: birthday ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16, flex: 1 }}>
                      {birthday ? formatDate(birthday) : 'Select your birthday'}
                    </Text>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
                  </Pressable>
                  {birthdayError ? (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{birthdayError}</Text>
                  ) : null}
                  {birthday && !birthdayError ? (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.ageReveal}>
                      <Text style={styles.ageRevealText}>
                        You're {new Date().getFullYear() - new Date(birthday).getFullYear()}!
                      </Text>
                      {calculateZodiacFromBirthday(birthday) ? (
                        <View style={styles.zodiacBadge}>
                          <Feather name="star" size={12} color="#A855F7" />
                          <Text style={styles.zodiacText}>{calculateZodiacFromBirthday(birthday)}</Text>
                        </View>
                      ) : null}
                    </Animated.View>
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
                {renderSectionLabel('Gender *')}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <OptionCard icon="user" label="Male" selected={gender === 'male'} onPress={() => setGender('male')} accentColor="#3b82f6" />
                  <OptionCard icon="user" label="Female" selected={gender === 'female'} onPress={() => setGender('female')} accentColor="#ec4899" />
                </View>
                <Pressable
                  onPress={() => setGender('other')}
                  style={[styles.optionCard, { width: '47%', marginTop: 10 }, gender === 'other' ? { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.12)' } : null]}
                >
                  <View style={[styles.optionCardIconWrap, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                    <Feather name="heart" size={22} color={gender === 'other' ? '#A855F7' : 'rgba(255,255,255,0.5)'} />
                  </View>
                  <Text style={[styles.optionCardLabel, gender === 'other' ? { color: '#A855F7' } : null]}>Other</Text>
                </Pressable>
              </>
            ) : null}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.inputLabel}>{user?.hostType === 'company' ? 'About Company *' : 'About You *'}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                {user?.hostType === 'company' ? 'Write a short description (at least 20 characters)' : 'Write a short bio (at least 20 characters)'}
              </Text>
              <TextInput
                style={styles.bioInput}
                multiline
                numberOfLines={4}
                maxLength={500}
                value={bio}
                onChangeText={setBio}
                placeholder={BIO_PLACEHOLDERS[placeholderIndex]}
                placeholderTextColor="rgba(255,255,255,0.2)"
                textAlignVertical="top"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                {bio.trim().length < 20 ? (
                  <Text style={{ fontSize: 11, color: '#ef4444' }}>
                    {20 - bio.trim().length} more chars needed
                  </Text>
                ) : <View />}
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {bio.length}/500
                </Text>
              </View>
            </View>
            {isHostProfessional ? (
              <>
                {renderSectionLabel(user?.hostType === 'company' ? 'Brokerage License Info' : 'Agent License Info')}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{user?.hostType === 'company' ? 'Brokerage Name' : 'Agency / Brokerage Name'}</Text>
                  <TextInput style={styles.textInput} value={agencyName} onChangeText={setAgencyName} placeholder="e.g. Compass, Corcoran" placeholderTextColor="rgba(255,255,255,0.25)" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>License Number</Text>
                  <TextInput style={styles.textInput} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. 10401234567" placeholderTextColor="rgba(255,255,255,0.25)" autoCapitalize="characters" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>License Photo</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                    Upload a photo of your real estate license for verification
                  </Text>
                  {licensePhoto ? (
                    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}>
                      <Image source={{ uri: licensePhoto }} style={{ width: '100%', height: 180, borderRadius: 12 }} contentFit="cover" />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 4 }}>
                        <Pressable
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, borderWidth: 1, borderColor: '#333' }}
                          onPress={async () => {
                            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
                            if (!result.canceled && result.assets[0]) { setLicensePhoto(result.assets[0].uri); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
                          }}
                        >
                          <Feather name="refresh-cw" size={14} color="#a855f7" />
                          <Text style={{ fontSize: 13, color: '#a855f7', fontWeight: '600' }}>Replace</Text>
                        </Pressable>
                        <Pressable
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, borderWidth: 1, borderColor: '#333' }}
                          onPress={() => { setLicensePhoto(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        >
                          <Feather name="trash-2" size={14} color="#ff6b5b" />
                          <Text style={{ fontSize: 13, color: '#ff6b5b', fontWeight: '600' }}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={{ borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 30, alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a' }}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
                        if (!result.canceled && result.assets[0]) { setLicensePhoto(result.assets[0].uri); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
                      }}
                    >
                      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="upload" size={22} color="#a855f7" />
                      </View>
                      <Text style={{ fontSize: 14, color: '#a855f7', fontWeight: '600' }}>Upload License Photo</Text>
                    </Pressable>
                  )}
                </View>
                {user?.hostType === 'company' ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Company Name</Text>
                    <TextInput style={styles.textInput} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Skyline Properties LLC" placeholderTextColor="rgba(255,255,255,0.25)" />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        );

      case 'budgetLocation':
        return (
          <View style={styles.stepInner}>
            <Text style={styles.questionText}>Monthly rent budget</Text>
            <View style={styles.budgetBar}>
              <LinearGradient
                colors={['#27AE60', '#F1C40F', '#E67E22', '#E74C3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.budgetGradient}
              />
            </View>
            <View style={styles.budgetRangeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetRangeLabel}>Min</Text>
                <View style={styles.budgetInputRow}>
                  <Text style={styles.budgetPrefix}>$</Text>
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
              <Text style={styles.budgetRangeSeparator}>to</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetRangeLabel}>Max</Text>
                <View style={styles.budgetInputRow}>
                  <Text style={styles.budgetPrefix}>$</Text>
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
            {budget ? (
              <Text style={styles.budgetZoneLabel}>
                {parseInt(budget) <= 1500 ? 'Budget-friendly' : parseInt(budget) <= 2500 ? 'Mid-range' : parseInt(budget) <= 3500 ? 'Premium' : 'Luxury'}
              </Text>
            ) : null}

            <Text style={[styles.questionText, { marginTop: 24 }]}>Where are you looking?</Text>
            <LocationPicker
              selectedState={selectedState}
              selectedCity={selectedCity}
              selectedNeighborhood={selectedNeighborhood}
              onStateChange={setSelectedState}
              onCityChange={setSelectedCity}
              onNeighborhoodChange={(n) => {
                setSelectedNeighborhood(n);
                if (n && !preferredNeighborhoods.includes(n) && preferredNeighborhoods.length < 5) {
                  setPreferredNeighborhoods(prev => [...prev, n]);
                }
              }}
            />

            <Text style={[styles.questionText, { marginTop: 20, fontSize: 16 }]}>
              Preferred neighborhoods (pick up to 5)
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
              {preferredNeighborhoods.length}/5 selected
            </Text>
            {preferredNeighborhoods.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {preferredNeighborhoods.map(hood => (
                  <View key={hood} style={styles.neighborhoodChip}>
                    <Text style={styles.neighborhoodChipText}>{hood}</Text>
                    <Pressable onPress={() => setPreferredNeighborhoods(prev => prev.filter(x => x !== hood))} hitSlop={8}>
                      <Feather name="x" size={12} color="#ff6b5b" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {Object.entries(BOROUGH_NEIGHBORHOODS).map(([borough, hoods]) => {
              const isExpanded = expandedBoroughs.includes(borough);
              const selectedCount = hoods.filter(h => preferredNeighborhoods.includes(h)).length;
              return (
                <View key={borough} style={styles.boroughSection}>
                  <Pressable
                    onPress={() => setExpandedBoroughs(prev => prev.includes(borough) ? prev.filter(b => b !== borough) : [...prev, borough])}
                    style={styles.boroughHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#ff6b5b' }}>{borough}</Text>
                      {selectedCount > 0 ? (
                        <View style={styles.boroughCount}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#ff6b5b' }}>{selectedCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                  {isExpanded ? (
                    <View style={styles.boroughHoods}>
                      {hoods.map(hood => {
                        const isSelected = preferredNeighborhoods.includes(hood);
                        const atMax = preferredNeighborhoods.length >= 3;
                        const disabled = !isSelected && atMax;
                        return (
                          <Pressable
                            key={hood}
                            disabled={disabled}
                            onPress={() => setPreferredNeighborhoods(prev => prev.includes(hood) ? prev.filter(x => x !== hood) : prev.length >= 3 ? prev : [...prev, hood])}
                            style={[styles.hoodChip, isSelected ? styles.hoodChipActive : null, disabled ? { opacity: 0.3 } : null]}
                          >
                            <Text style={{ fontSize: 12, color: isSelected ? '#ff6b5b' : '#ccc' }}>{hood}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Zip code (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={zipCode}
                onChangeText={(t) => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder="10001"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <Text style={[styles.questionText, { marginTop: 24 }]}>What do you do for work?</Text>
            <OccupationBarSelector selectedOccupation={occupation} onChange={setOccupation} />
          </View>
        );

      case 'dealbreakers': {
        const toggleDealbreaker = (value: string) => {
          setDealbreakers(prev => prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]);
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
        };
        const dealbreakerOptions: { value: string; icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
          { value: 'no_smokers', icon: 'slash', label: 'No smokers', desc: 'Smoking is a hard no' },
          { value: 'no_cats', icon: 'x-circle', label: 'No cats', desc: "Can't live with cats" },
          { value: 'no_dogs', icon: 'x-circle', label: 'No dogs', desc: "Can't live with dogs" },
          { value: 'no_pets', icon: 'shield-off', label: 'No pets at all', desc: 'Zero pets in the home' },
          { value: 'private_bathroom', icon: 'lock', label: 'Private bathroom', desc: 'Not sharing a bathroom' },
          { value: 'same_sex_only', icon: 'users', label: 'Same-sex only', desc: 'Gender-matched household' },
          { value: 'no_overnight_guests', icon: 'moon', label: 'No overnight guests', desc: 'Keep the home private at night' },
          { value: 'quiet_hours', icon: 'volume-x', label: 'Strict quiet hours', desc: 'Silence after a set time' },
          { value: 'no_opposite_gender', icon: 'user-x', label: 'Opposite gender roommate', desc: 'Same gender preferred' },
          { value: 'no_wfh_all_day', icon: 'home', label: 'WFH all day (I need privacy)', desc: 'Need alone time at home' },
        ];
        return (
          <View style={styles.stepInner}>
            <Text style={styles.dealbreakersHint}>
              These are hard filters. Leave blank if you're flexible.
            </Text>
            <View style={{ gap: 8 }}>
              {dealbreakerOptions.map(opt => (
                <SelectionCard
                  key={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                  subtitle={opt.desc}
                  selected={dealbreakers.includes(opt.value)}
                  onPress={() => toggleDealbreaker(opt.value)}
                  danger
                />
              ))}
            </View>
            {dealbreakers.length > 0 ? (
              <Animated.View entering={FadeIn} style={styles.dealbreakerCount}>
                <Feather name="shield" size={14} color="#E74C3C" />
                <Text style={styles.dealbreakerCountText}>{dealbreakers.length} dealbreaker{dealbreakers.length > 1 ? 's' : ''} set</Text>
              </Animated.View>
            ) : null}
            <Text style={styles.dealbreakersFootnote}>You can update these anytime in your profile settings.</Text>
          </View>
        );
      }

      case 'houseRules':
        return (
          <View style={styles.stepInner}>
            {renderSectionLabel('Sleep Schedule')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <OptionCard icon="sunrise" label="Early Bird" subtitle="Bed by 10pm" selected={sleepSchedule === 'early_sleeper'} onPress={() => setSleepSchedule('early_sleeper')} accentColor="#F59E0B" />
              <OptionCard icon="moon" label="Night Owl" subtitle="After midnight" selected={sleepSchedule === 'late_sleeper'} onPress={() => setSleepSchedule('late_sleeper')} accentColor="#6366F1" />
              <OptionCard icon="clock" label="Flexible" subtitle="Can adjust" selected={sleepSchedule === 'flexible'} onPress={() => setSleepSchedule('flexible')} accentColor="#3ECF8E" />
              <OptionCard icon="shuffle" label="Shift Worker" subtitle="Irregular hours" selected={sleepSchedule === 'irregular'} onPress={() => setSleepSchedule('irregular')} accentColor="#ec4899" />
            </View>

            <View style={{ height: 24 }} />
            {renderSectionLabel('Cleanliness Standard')}
            <ScaleSelector
              levels={[
                { value: 'relaxed', icon: 'coffee', label: 'Relaxed', desc: "Life's too short to stress about dishes" },
                { value: 'moderately_tidy', icon: 'check-circle', label: 'Moderate', desc: 'I clean up after myself' },
                { value: 'very_tidy', icon: 'star', label: 'Very Tidy', desc: 'Everything has a place' },
              ]}
              selected={cleanliness || ''}
              onSelect={(v) => setCleanliness(v as any)}
              accentColor="#3b82f6"
            />

            <View style={{ height: 24 }} />
            {renderSectionLabel('Smoking')}
            <ScaleSelector
              levels={[
                { value: 'no', icon: 'slash', label: 'Non-Smoker', desc: "Don't smoke, prefer no smoking" },
                { value: 'only_outside', icon: 'wind', label: 'Outside Only', desc: 'I smoke but only outside' },
                { value: 'yes', icon: 'cloud', label: 'Smoker', desc: 'Roommate should be OK with it' },
              ]}
              selected={smoking || ''}
              onSelect={(v) => setSmoking(v as any)}
              accentColor="#F59E0B"
            />

            <View style={{ height: 24 }} />
            {renderSectionLabel('Pets')}
            <ScaleSelector
              levels={[
                { value: 'no_pets', icon: 'x-circle', label: 'No Pets', desc: "I don't have or want pets" },
                { value: 'have_pets', icon: 'heart', label: 'I Have Pets', desc: 'My pet will live with us' },
                { value: 'open_to_pets', icon: 'smile', label: 'Open to Pets', desc: "Fine if roommate has pets" },
              ]}
              selected={pets || ''}
              onSelect={(v) => setPets(v as any)}
              accentColor="#3ECF8E"
            />
          </View>
        );

      case 'lifestyle':
        return (
          <View style={styles.stepInner}>
            {renderSectionLabel('Work Style')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <OptionCard icon="briefcase" label="At the Office" subtitle="Out all day" selected={workLocation === 'office_fulltime'} onPress={() => setWorkLocation('office_fulltime')} accentColor="#3b82f6" />
              <OptionCard icon="monitor" label="Working from Home" subtitle="Home most days" selected={workLocation === 'wfh_fulltime'} onPress={() => setWorkLocation('wfh_fulltime')} accentColor="#A855F7" />
              <OptionCard icon="repeat" label="Hybrid" subtitle="Mix of both" selected={workLocation === 'hybrid'} onPress={() => setWorkLocation('hybrid')} accentColor="#3ECF8E" />
              <OptionCard icon="clock" label="It Varies" subtitle="Shift work / varies" selected={workLocation === 'irregular'} onPress={() => setWorkLocation('irregular')} accentColor="#F59E0B" />
            </View>

            <View style={{ height: 24 }} />
            {renderSectionLabel('Guests at Home')}
            <ScaleSelector
              levels={[
                { value: 'prefer_no_guests', icon: 'lock', label: 'No Guests', desc: 'Keep the home private' },
                { value: 'rarely', icon: 'user', label: 'Rarely', desc: 'Guests maybe once a month' },
                { value: 'occasionally', icon: 'users', label: 'Occasionally', desc: 'Weekends sometimes' },
                { value: 'frequently', icon: 'user-plus', label: 'Often', desc: 'Friends over regularly' },
              ]}
              selected={guestPolicy || ''}
              onSelect={(v) => setGuestPolicy(v as any)}
              accentColor="#ec4899"
            />

            <View style={{ height: 24 }} />
            {renderSectionLabel('Noise Level')}
            <ScaleSelector
              levels={[
                { value: 'prefer_quiet', icon: 'volume', label: 'Very Quiet', desc: 'I need near-silence to relax' },
                { value: 'normal_noise', icon: 'volume-1', label: 'Moderate', desc: 'Normal household sounds' },
                { value: 'loud_environments', icon: 'volume-2', label: 'Lively', desc: 'Love an active, buzzy home' },
              ]}
              selected={noiseTolerance || ''}
              onSelect={(v) => setNoiseTolerance(v as any)}
              accentColor="#F59E0B"
            />
          </View>
        );

      case 'yourSetup':
        return (
          <View style={styles.stepInner}>
            {renderSectionLabel('Looking For')}
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable
                onPress={() => setLookingFor('room')}
                style={[styles.bigCard, lookingFor === 'room' ? styles.bigCardActive : null]}
              >
                <View style={[styles.bigCardIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
                  <Feather name="layout" size={28} color={lookingFor === 'room' ? '#ff6b5b' : 'rgba(255,255,255,0.4)'} />
                </View>
                <Text style={[styles.bigCardLabel, lookingFor === 'room' ? { color: '#ff6b5b' } : null]}>A Room</Text>
                <Text style={styles.bigCardDesc}>In a shared place</Text>
              </Pressable>
              <Pressable
                onPress={() => setLookingFor('entire_apartment')}
                style={[styles.bigCard, lookingFor === 'entire_apartment' ? styles.bigCardActive : null]}
              >
                <View style={[styles.bigCardIcon, { backgroundColor: 'rgba(62,207,142,0.12)' }]}>
                  <Feather name="home" size={28} color={lookingFor === 'entire_apartment' ? '#3ECF8E' : 'rgba(255,255,255,0.4)'} />
                </View>
                <Text style={[styles.bigCardLabel, lookingFor === 'entire_apartment' ? { color: '#3ECF8E' } : null]}>Full Apartment</Text>
                <Text style={styles.bigCardDesc}>An entire place</Text>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { marginTop: 20 }]}>Move-in Date</Text>
              <Pressable style={styles.dateTrigger} onPress={() => setShowMoveInPicker(true)}>
                <Feather name="calendar" size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 12 }} />
                <Text style={{ color: moveInDate ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16, flex: 1 }}>
                  {moveInDate ? formatDate(moveInDate) : 'Select move-in date'}
                </Text>
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
                {renderSectionLabel('Private Bathroom')}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <OptionCard icon="lock" label="Private" selected={privateBathroom === true} onPress={() => setPrivateBathroom(true)} wide={false} accentColor="#3b82f6" />
                  <OptionCard icon="users" label="Shared is fine" selected={privateBathroom === false} onPress={() => setPrivateBathroom(false)} wide={false} accentColor="#3ECF8E" />
                </View>
              </>
            ) : null}

            <View style={{ height: 20 }} />
            {renderSectionLabel('How many roommates?')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { v: 0, icon: 'star' as const, label: 'No Preference' },
                { v: 1, icon: 'user' as const, label: '1 Roommate' },
                { v: 2, icon: 'users' as const, label: '2 Roommates' },
                { v: 3, icon: 'users' as const, label: '3 Roommates' },
                { v: 4, icon: 'home' as const, label: '4+' },
              ].map(opt => (
                <OptionCard
                  key={opt.v}
                  icon={opt.icon}
                  label={opt.label}
                  selected={desiredRoommateCount === opt.v}
                  onPress={() => setDesiredRoommateCount(opt.v)}
                  accentColor="#A855F7"
                />
              ))}
            </View>

            <View style={{ height: 20 }} />
            {renderSectionLabel('Household gender preference')}
            <ScaleSelector
              levels={[
                { value: 'any', icon: 'globe', label: 'No Preference', desc: 'Open to anyone' },
                { value: 'male_only', icon: 'user', label: 'Male Only' },
                { value: 'female_only', icon: 'user', label: 'Female Only' },
                { value: 'same_gender', icon: 'users', label: 'Same Gender', desc: 'Match my gender' },
              ]}
              selected={householdGenderPref}
              onSelect={(v) => setHouseholdGenderPref(v as any)}
              accentColor="#ec4899"
            />

            <View style={{ height: 20 }} />
            <Pressable
              onPress={() => setPiAutoMatchEnabled(!piAutoMatchEnabled)}
              style={[styles.piAutoCard, piAutoMatchEnabled ? styles.piAutoCardActive : null]}
            >
              <View style={styles.piAutoIcon}>
                <Feather name="cpu" size={22} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.piAutoLabel, piAutoMatchEnabled ? { color: '#A855F7' } : null]}>
                  Let Pi find your perfect group
                </Text>
                <Text style={styles.piAutoDesc}>
                  Pi automatically matches you with compatible roommates
                </Text>
              </View>
              <View style={[styles.piAutoToggle, piAutoMatchEnabled ? styles.piAutoToggleOn : null]}>
                <View style={[styles.piAutoToggleDot, piAutoMatchEnabled ? styles.piAutoToggleDotOn : null]} />
              </View>
            </Pressable>
          </View>
        );

      case 'interests':
        return (
          <View style={styles.stepInner}>
            <InterestCategoryBars selectedTags={interests} onChange={setInterests} maxTags={10} />
            {interests.length >= 3 ? (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.vibeSummary}>
                <Feather name="zap" size={14} color="#A855F7" />
                <Text style={styles.vibeSummaryText}>{generateVibeSummary(interests)}</Text>
              </Animated.View>
            ) : null}
          </View>
        );

      case 'personality': {
        const PERSONALITY_QUESTIONS = [
          {
            id: 'q1',
            question: 'When you get home after a long day:',
            options: [
              { value: 'alone', icon: 'book' as const, label: 'Decompress alone quietly' },
              { value: 'music', icon: 'music' as const, label: 'Put on music and unwind' },
              { value: 'social', icon: 'phone' as const, label: 'Call friends or catch up' },
              { value: 'kitchen', icon: 'coffee' as const, label: 'Cook and relax in the kitchen' },
            ],
          },
          {
            id: 'q2',
            question: 'How do you handle issues with a roommate?',
            options: [
              { value: 'text', icon: 'message-circle' as const, label: 'Text \u2014 keeps things low pressure' },
              { value: 'direct', icon: 'message-square' as const, label: 'Face to face, direct and clear' },
              { value: 'meeting', icon: 'clipboard' as const, label: 'Sit down together and talk it out' },
              { value: 'flow', icon: 'smile' as const, label: 'Go with the flow, no drama' },
            ],
          },
          {
            id: 'q3',
            question: 'The kitchen after cooking:',
            options: [
              { value: 'immediate', icon: 'zap' as const, label: 'Cleaned up immediately' },
              { value: 'sameday', icon: 'clock' as const, label: 'Before end of day' },
              { value: 'nextday', icon: 'moon' as const, label: 'Next morning is fine' },
              { value: 'flexible', icon: 'meh' as const, label: "Doesn't bother me" },
            ],
          },
          {
            id: 'q4',
            question: 'What kind of roommate relationship?',
            options: [
              { value: 'friends', icon: 'heart' as const, label: 'Actual friends \u2014 hang out' },
              { value: 'friendly', icon: 'smile' as const, label: 'Friendly but independent' },
              { value: 'respectful', icon: 'home' as const, label: 'Respectful co-living' },
              { value: 'parallel', icon: 'arrow-right' as const, label: 'Ships passing \u2014 rarely see each other' },
            ],
          },
          {
            id: 'q5',
            question: 'How far can you commute?',
            options: [
              { value: 'under_20', icon: 'navigation' as const, label: 'Under 20 minutes' },
              { value: 'under_40', icon: 'map' as const, label: 'Up to 40 minutes' },
              { value: 'under_60', icon: 'clock' as const, label: 'Up to an hour' },
              { value: 'flexible', icon: 'globe' as const, label: 'Flexible \u2014 remote or any' },
            ],
          },
        ];

        return (
          <View style={styles.stepInner}>
            {PERSONALITY_QUESTIONS.map((q, qIdx) => (
              <Animated.View key={q.id} entering={FadeInDown.delay(qIdx * 50).duration(300)} style={styles.personalityBlock}>
                <Text style={styles.personalityQuestion}>{q.question}</Text>
                <View style={{ gap: 6 }}>
                  {q.options.map((opt) => {
                    const active = personalityAnswers[q.id] === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPersonalityAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
                        style={[styles.personalityOption, active ? styles.personalityOptionActive : null]}
                      >
                        <View style={[styles.personalityOptIcon, active ? { backgroundColor: 'rgba(255,107,91,0.15)' } : null]}>
                          <Feather name={opt.icon} size={16} color={active ? '#ff6b5b' : 'rgba(255,255,255,0.4)'} />
                        </View>
                        <Text style={[styles.personalityOptLabel, active ? { color: '#ff6b5b' } : null]}>{opt.label}</Text>
                        {active ? <Feather name="check" size={14} color="#ff6b5b" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            ))}
          </View>
        );
      }

      case 'finalWords':
        return (
          <View style={styles.stepInner}>
            {renderSectionLabel('In your own words')}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
              Write anything you want potential roommates to know about you.
            </Text>
            <View style={styles.snippetRow}>
              {PROFILE_NOTE_SNIPPETS.map((s, i) => (
                <Pressable key={i} onPress={() => setProfileNote(s.text)} style={styles.snippetChip}>
                  <Text style={styles.snippetChipText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.letterInput, profileNote.length > 0 ? { borderColor: '#ff6b5b' } : null]}>
              <TextInput
                style={styles.letterTextInput}
                value={profileNote}
                onChangeText={(text) => setProfileNote(text.slice(0, profileNoteCharLimit))}
                placeholder="e.g. I work from home so I'm around a lot during the day, but I wear headphones and stay in my room..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                multiline
                maxLength={profileNoteCharLimit}
              />
              <Text style={[styles.charCount, profileNote.length > profileNoteCharLimit * 0.9 ? { color: '#ef4444' } : null]}>
                {profileNote.length}/{profileNoteCharLimit}
              </Text>
            </View>
            <View style={styles.piHint}>
              <Feather name="zap" size={14} color="#ff6b5b" />
              <Text style={styles.piHintText}>Pi reads this when roommates ask about you</Text>
            </View>

            <View style={{ height: 28 }} />
            {renderSectionLabel('Describe your dream roommate')}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
              Tell Pi exactly what you're looking for. The more specific, the better your matches.
            </Text>
            <View style={styles.snippetRow}>
              {IDEAL_SNIPPETS.map((s, i) => (
                <Pressable key={i} onPress={() => setIdealRoommateText(s.text)} style={styles.snippetChip}>
                  <Text style={styles.snippetChipText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.letterInput, idealRoommateText.length > 0 ? { borderColor: '#A855F7' } : null]}>
              <TextInput
                style={styles.letterTextInput}
                value={idealRoommateText}
                onChangeText={(text) => setIdealRoommateText(text.slice(0, idealRoommateCharLimit))}
                placeholder="e.g. Someone who's clean but not uptight. Ideally on a similar schedule..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                multiline
                maxLength={idealRoommateCharLimit}
              />
              <Text style={[styles.charCount, idealRoommateText.length > idealRoommateCharLimit * 0.9 ? { color: '#ef4444' } : null]}>
                {idealRoommateText.length}/{idealRoommateCharLimit}
              </Text>
            </View>
            <View style={[styles.piHint, { backgroundColor: 'rgba(168,85,247,0.08)' }]}>
              <Feather name="cpu" size={14} color="#A855F7" />
              <Text style={styles.piHintText}>Pi reads this to find people who actually fit</Text>
            </View>
            <TouchableOpacity onPress={() => isLastStep ? handleSave() : goNext()} style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ paddingTop: insets.top + 10, backgroundColor: '#0d0d0d' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 10 }}>
          <Pressable
            onPress={() => {
              const parent = navigation.getParent?.();
              if (user?.role === 'renter') {
                if (parent) parent.navigate('Explore');
                else { try { (navigation as any).navigate('Explore'); } catch {} }
              } else {
                if (parent) parent.navigate('Dashboard', { screen: 'DashboardMain' });
                else { try { (navigation as any).navigate('DashboardMain'); } catch {} }
              }
            }}
            hitSlop={8}
          >
            <RhomeLogo variant="icon-only" size="sm" />
          </Pressable>
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }} numberOfLines={1}>
              {isMissingMode ? `${currentFilteredIndex + 1} of ${stepsToShow.length}` : (isOnboarding ? 'Create Profile' : 'Edit Profile')}
            </Text>
          </View>
          {isMissingMode ? (
            <Pressable onPress={() => navigation.goBack()} style={styles.navButton}>
              <Feather name="x" size={24} color="rgba(255,255,255,0.5)" />
            </Pressable>
          ) : !isLastStep ? (
            <Pressable
              onPress={() => {
                setDirection('forward');
                setCurrentFilteredIndex(prev => Math.min(prev + 1, stepsToShow.length - 1));
                updateUser(buildProfileData()).catch(() => {});
              }}
              hitSlop={8}
              style={{ paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Skip</Text>
            </Pressable>
          ) : null}
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
        <LinearGradient
          colors={STEP_ACCENT_COLORS[currentStepId] || ['transparent', 'transparent']}
          style={styles.backgroundOrb}
        />

        {milestone ? <MilestoneToast text={milestone} /> : null}

        <Animated.View
          key={currentStepId}
          entering={direction === 'forward' ? FadeInRight.duration(280).springify() : FadeInLeft.duration(280).springify()}
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepIconWrap}>
              <Feather name={STEP_ICONS[currentStepId]} size={28} color="#ff6b5b" />
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{currentFilteredIndex + 1} of {stepsToShow.length}</Text>
            </View>
            <Text style={styles.stepTitle}>
              {isPlaceSeekerUser ? (PLACE_SEEKER_TITLES[currentStepId] || STEP_TITLES[currentStepId]) : STEP_TITLES[currentStepId]}
            </Text>
            <Text style={styles.stepSubtitle}>
              {isPlaceSeekerUser ? (PLACE_SEEKER_SUBTITLES[currentStepId] || STEP_SUBTITLES[currentStepId]) : STEP_SUBTITLES[currentStepId]}
            </Text>
          </View>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 16) + 80 }]}>
        {isLastStep ? (
          <Animated.View style={pulseStyle}>
            <Pressable
              style={{ overflow: 'hidden', borderRadius: 16, opacity: isSaving ? 0.7 : 1 }}
              onPress={handleSave}
              disabled={isSaving}
            >
              <LinearGradient
                colors={isStepValid ? ['#ff6b5b', '#e83a2a'] : ['#333', '#222']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextButton}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Let's Go!</Text>
                    <Feather name="check" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={pulseStyle}>
            <Pressable
              style={{ overflow: 'hidden', borderRadius: 16 }}
              onPress={goNext}
            >
              <LinearGradient
                colors={isStepValid ? ['#ff6b5b', '#e83a2a'] : ['#333', '#222']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
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
  backgroundOrb: {
    position: 'absolute',
    top: -100,
    left: -50,
    width: SCREEN_WIDTH + 100,
    height: 400,
    borderRadius: 200,
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
  stepContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  mainPhotoSlot: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,107,91,0.4)',
    borderStyle: 'dashed',
    alignSelf: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  mainPhotoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  mainRibbon: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,107,91,0.9)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  mainRibbonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  secondarySlot: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    backgroundColor: '#141414',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#fff',
  },
  bioInput: {
    height: 140,
    backgroundColor: '#141414',
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
    backgroundColor: '#141414',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 18,
  },
  ageReveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  ageRevealText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3ECF8E',
  },
  zodiacBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  zodiacText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A855F7',
  },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#ff6b5b',
  },
  sectionLabelText: {
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

  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  selectionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  selectionCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  optionCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  optionCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  optionCardSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  scaleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  scaleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scaleDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  budgetBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  budgetGradient: {
    flex: 1,
    borderRadius: 3,
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
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
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
  budgetRangeInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  budgetRangeSeparator: {
    color: '#888',
    marginBottom: 16,
  },
  budgetZoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 8,
  },
  neighborhoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ff6b5b',
  },
  neighborhoodChipText: {
    fontSize: 12,
    color: '#ff6b5b',
    marginRight: 6,
  },
  boroughSection: {
    marginBottom: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  boroughHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  boroughCount: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  boroughHoods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  hoodChip: {
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  hoodChipActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
  },

  dealbreakersHint: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 16,
  },
  dealbreakersFootnote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  dealbreakerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: 10,
    alignSelf: 'center',
  },
  dealbreakerCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },

  bigCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  bigCardActive: {
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  bigCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  bigCardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },

  piAutoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    gap: 14,
  },
  piAutoCardActive: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  piAutoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  piAutoLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  piAutoDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  piAutoToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    padding: 2,
    justifyContent: 'center',
  },
  piAutoToggleOn: {
    backgroundColor: '#A855F7',
  },
  piAutoToggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#666',
  },
  piAutoToggleDotOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },

  vibeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 14,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  vibeSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A855F7',
    flex: 1,
  },

  personalityBlock: {
    marginBottom: 24,
  },
  personalityQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  personalityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  personalityOptionActive: {
    borderColor: '#ff6b5b',
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b5b',
  },
  personalityOptIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalityOptLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#ccc',
  },

  letterInput: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  letterTextInput: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  snippetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  snippetChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  snippetChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  piHint: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderRadius: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  piHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  milestoneToast: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  milestoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  milestoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
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
    gap: 8,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
