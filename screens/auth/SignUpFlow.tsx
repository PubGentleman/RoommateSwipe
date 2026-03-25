import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Easing,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { RhomeLogo } from '../../components/RhomeLogo';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

type AccountType = 'renter' | 'individual' | 'agent' | 'company';

interface SignUpState {
  accountType: AccountType | null;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city: string;
  licenseNumber: string;
  agencyName: string;
  companyName: string;
  propertyCount: string;
  budgetRange: string;
  roomType: string;
  propertyType: string;
  profilePhoto: string | null;
}

const BUDGET_RANGES = ['Under $800', '$800-$1200', '$1200-$1800', '$1800-$2500', '$2500+'];
const ROOM_TYPES = [
  { id: 'private', icon: 'lock', label: 'Private Room' },
  { id: 'shared', icon: 'users', label: 'Shared Room' },
  { id: 'apartment', icon: 'home', label: 'Full Apartment' },
];
const PROPERTY_TYPES = [
  { id: 'apartment', icon: 'home', label: 'Apartment' },
  { id: 'house', icon: 'home', label: 'House' },
  { id: 'condo', icon: 'grid', label: 'Condo' },
  { id: 'townhouse', icon: 'layers', label: 'Townhouse' },
  { id: 'studio', icon: 'square', label: 'Studio' },
];

const ACCOUNT_TYPES: { id: AccountType; icon: string; label: string; description: string; color: string; hostOnly?: boolean }[] = [
  { id: 'renter', icon: 'search', label: 'Renter', description: "I'm looking for a place to rent", color: '#6C63FF' },
  { id: 'individual', icon: 'key', label: 'Individual Host', description: 'I rent out my own property', color: '#3B82F6' },
  { id: 'agent', icon: 'briefcase', label: 'Agent', description: "I'm a licensed real estate agent", color: '#F59E0B', hostOnly: true },
  { id: 'company', icon: 'grid', label: 'Company', description: 'I manage properties for clients', color: '#22C55E', hostOnly: true },
];

const CITIES = [
  'Miami, FL',
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Austin, TX',
  'San Francisco, CA',
  'Boston, MA',
  'Seattle, WA',
  'Atlanta, GA',
  'Denver, CO',
  'Philadelphia, PA',
];

const PROPERTY_COUNTS = ['1-10', '11-50', '51-200', '200+'];

export const SignUpFlow = ({ onBackToLogin }: { onBackToLogin: () => void }) => {
  const { register } = useAuth();
  const { alert: showAlert } = useConfirm();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<SignUpState>({
    accountType: null,
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    city: '',
    licenseNumber: '',
    agencyName: '',
    companyName: '',
    propertyCount: '',
    budgetRange: '',
    roomType: '',
    propertyType: '',
    profilePhoto: null,
  });

  type StepId = 'accountType' | 'credentials' | 'location' | 'details' | 'photo' | 'complete';

  const getSteps = (): StepId[] => {
    return ['accountType', 'credentials', 'location', 'details', 'photo', 'complete'];
  };

  const steps = getSteps();
  const currentStepId = steps[currentStep] || 'accountType';
  const totalProgressSteps = steps.length - 1;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [agentNotice, setAgentNotice] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragAnim = useRef(new Animated.Value(0)).current;

  const goForward = useCallback(() => {
    const nextStep = currentStep + 1;
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(SCREEN_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [currentStep, slideAnim]);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    const prevStep = currentStep - 1;
    dragAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(prevStep);
      slideAnim.setValue(-SCREEN_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [currentStep, slideAnim, dragAnim]);

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) dragAnim.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD && currentStepRef.current > 0) {
          goBackRef.current();
        } else {
          Animated.spring(dragAnim, {
            toValue: 0,
            tension: 120,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const updateState = (updates: Partial<SignUpState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleAccountTypeSelect = (type: AccountType) => {
    setSelectedCard(type);
    updateState({ accountType: type });
    if (type === 'agent' || type === 'company') {
      setAgentNotice(true);
      setTimeout(() => {
        setAgentNotice(false);
        goForward();
      }, 600);
    } else {
      setTimeout(() => {
        setSelectedCard(null);
        goForward();
      }, 150);
    }
  };

  const handleCredentialsSubmit = async () => {
    setError('');
    if (!state.firstName.trim()) { setError('Please enter your first name'); return; }
    if (!state.lastName.trim()) { setError('Please enter your last name'); return; }
    if (state.accountType === 'company' && !state.companyName.trim()) { setError('Please enter your company name'); return; }
    if (!state.email.trim()) { setError('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) { setError('Please enter a valid email'); return; }
    if (!state.password || state.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    goForward();
  };

  const handleCitySelect = (city: string) => {
    setSelectedCard(city);
    updateState({ city });
    setTimeout(() => {
      setSelectedCard(null);
      goForward();
    }, 150);
  };

  const handlePhotoUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      updateState({ profilePhoto: result.assets[0].uri });
      setTimeout(goForward, 300);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const role = state.accountType === 'renter' ? 'renter' : 'host';
      const hostType = state.accountType === 'renter' ? null : (state.accountType as 'individual' | 'agent' | 'company');
      const companyName = state.accountType === 'company' && state.companyName.trim() ? state.companyName.trim() : undefined;
      const fullName = `${state.firstName.trim()} ${state.lastName.trim()}`;
      await register(state.email.trim(), state.password, fullName, role as any, hostType, companyName, state.firstName.trim(), state.lastName.trim());
    } catch (err: any) {
      await showAlert({ title: 'Error', message: err?.message || 'Failed to create account. Please try again.', variant: 'warning' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCities = citySearch.trim()
    ? CITIES.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))
    : CITIES;

  const progressIndex = Math.max(0, currentStep - 1);

  const ProgressDots = () => (
    <View style={styles.dotsRow}>
      {Array.from({ length: totalProgressSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < progressIndex ? styles.dotComplete : null,
            i === progressIndex ? styles.dotActive : null,
          ]}
        />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (currentStepId) {
      case 'accountType': return renderAccountType();
      case 'credentials': return renderCredentials();
      case 'location': return renderLocation();
      case 'details': return renderDetails();
      case 'photo': return renderPhoto();
      case 'complete': return renderComplete();
      default: return null;
    }
  };

  const renderAccountType = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <RhomeLogo variant="horizontal" size="sm" />
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.headline}>Who are you?</Text>
        <Text style={styles.subheadline}>This shapes your entire Rhome experience</Text>
        <View style={styles.typeGrid}>
          {ACCOUNT_TYPES.map((type) => {
            const isSelected = selectedCard === type.id;
            return (
              <Pressable
                key={type.id}
                style={[
                  styles.typeCard,
                  isSelected ? { borderColor: type.color, backgroundColor: `${type.color}15` } : null,
                ]}
                onPress={() => handleAccountTypeSelect(type.id)}
              >
                {type.hostOnly ? (
                  <View style={styles.hostOnlyBadge}>
                    <Text style={styles.hostOnlyBadgeText}>Host-only account</Text>
                  </View>
                ) : null}
                <View style={[styles.typeIconWrap, { backgroundColor: `${type.color}20` }]}>
                  <Feather name={type.icon as any} size={22} color={type.color} />
                </View>
                <Text style={styles.typeLabel}>{type.label}</Text>
                <Text style={styles.typeDesc}>{type.description}</Text>
              </Pressable>
            );
          })}
        </View>
        {agentNotice ? (
          <View style={styles.agentNotice}>
            <Feather name="info" size={14} color="#F59E0B" />
            <Text style={styles.agentNoticeText}>
              This creates a host-only account. You cannot switch to renter later.
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.stepFooter}>
        <Pressable onPress={onBackToLogin} hitSlop={8}>
          <Text style={styles.switchLink}>Already have an account? <Text style={styles.switchLinkBold}>Sign In</Text></Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCredentials = () => {
    const headlines: Record<AccountType, string> = {
      renter: 'Set up your profile',
      individual: 'Set up your host account',
      agent: 'Set up your agent account',
      company: 'Set up your company account',
    };
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepTopBar}>
          <View style={styles.topBarSpacer} />
          <ProgressDots />
          <View style={styles.topBarSpacer} />
        </View>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headline}>{headlines[state.accountType!]}</Text>
          <View style={styles.formFields}>
            <View style={styles.nameRow}>
              <View style={[styles.field, { flex: 1, marginRight: 6 }]}>
                <Text style={styles.fieldLabel}>FIRST NAME</Text>
                <View style={styles.inputWrap}>
                  <Feather name="user" size={16} color="rgba(255,255,255,0.35)" />
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={state.firstName}
                    onChangeText={(v) => updateState({ firstName: v })}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={[styles.field, { flex: 1, marginLeft: 6 }]}>
                <Text style={styles.fieldLabel}>LAST NAME</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Last name"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={state.lastName}
                    onChangeText={(v) => updateState({ lastName: v })}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>
            {state.accountType === 'company' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>COMPANY NAME</Text>
                <View style={styles.inputWrap}>
                  <Feather name="briefcase" size={16} color="rgba(255,255,255,0.35)" />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Skyline Property Group"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={state.companyName}
                    onChangeText={(v) => updateState({ companyName: v })}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color="rgba(255,255,255,0.35)" />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={state.email}
                  onChangeText={(v) => updateState({ email: v })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" />
                <TextInput
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={state.password}
                  onChangeText={(v) => updateState({ password: v })}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.35)" />
                </Pressable>
              </View>
            </View>
          </View>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#ff6b5b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Pressable onPress={handleCredentialsSubmit}>
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR CONTINUE WITH</Text>
            <View style={styles.orLine} />
          </View>
          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn} onPress={() => showAlert({ title: 'Google Sign In', message: 'Google authentication will be available in a future update.', variant: 'info' })}>
              <Feather name="globe" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.socialBtnText}>Google</Text>
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={() => showAlert({ title: 'Apple Sign In', message: 'Apple authentication will be available in a future update.', variant: 'info' })}>
              <Feather name="smartphone" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.socialBtnText}>Apple</Text>
            </Pressable>
          </View>
          <Pressable onPress={onBackToLogin} hitSlop={8} style={styles.switchRowCenter}>
            <Text style={styles.switchLink}>Already have an account? <Text style={styles.switchLinkBold}>Sign In</Text></Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  const renderLocation = () => {
    const headlines: Record<AccountType, string> = {
      renter: 'Where are you looking?',
      individual: 'Where is your property?',
      agent: 'Where do you work?',
      company: 'Where are your properties?',
    };
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepTopBar}>
          <View style={styles.topBarSpacer} />
          <ProgressDots />
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.headline}>{headlines[state.accountType!]}</Text>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search cities..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={citySearch}
              onChangeText={setCitySearch}
              autoCapitalize="none"
            />
            {citySearch ? (
              <Pressable onPress={() => setCitySearch('')} hitSlop={8}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.35)" />
              </Pressable>
            ) : null}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.cityScroll}>
            <View style={styles.cityChipGrid}>
              {filteredCities.map((city) => (
                <Pressable
                  key={city}
                  style={[
                    styles.cityChip,
                    selectedCard === city ? styles.cityChipActive : null,
                  ]}
                  onPress={() => handleCitySelect(city)}
                >
                  <Feather name="map-pin" size={14} color={selectedCard === city ? '#fff' : 'rgba(255,255,255,0.5)'} />
                  <Text style={[styles.cityChipText, selectedCard === city ? styles.cityChipTextActive : null]}>{city}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const handleDetailsSubmit = () => {
    setError('');
    if (state.accountType === 'agent' && !state.licenseNumber.trim()) {
      setError('License number is required');
      return;
    }
    goForward();
  };

  const renderDetails = () => {
    const headlines: Record<AccountType, string> = {
      renter: 'Your preferences',
      individual: 'Your property',
      agent: 'Your license details',
      company: 'Your company details',
    };

    const renderRenterDetails = () => (
      <>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>BUDGET RANGE</Text>
          <View style={styles.countChipRow}>
            {BUDGET_RANGES.map((range) => (
              <Pressable
                key={range}
                style={[styles.countChip, state.budgetRange === range ? styles.countChipActive : null]}
                onPress={() => updateState({ budgetRange: range })}
              >
                <Text style={[styles.countChipText, state.budgetRange === range ? styles.countChipTextActive : null]}>{range}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ROOM TYPE PREFERENCE</Text>
          <View style={styles.optionsList}>
            {ROOM_TYPES.map((rt) => (
              <Pressable
                key={rt.id}
                style={[styles.optionCard, state.roomType === rt.id ? styles.optionCardActive : null]}
                onPress={() => updateState({ roomType: rt.id })}
              >
                <View style={styles.optionIconWrap}>
                  <Feather name={rt.icon as any} size={20} color={state.roomType === rt.id ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
                </View>
                <Text style={[styles.optionLabel, state.roomType === rt.id ? styles.optionLabelActive : null]}>{rt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </>
    );

    const renderIndividualDetails = () => (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>PROPERTY TYPE</Text>
        <View style={styles.optionsList}>
          {PROPERTY_TYPES.map((pt) => (
            <Pressable
              key={pt.id}
              style={[styles.optionCard, state.propertyType === pt.id ? styles.optionCardActive : null]}
              onPress={() => updateState({ propertyType: pt.id })}
            >
              <View style={styles.optionIconWrap}>
                <Feather name={pt.icon as any} size={20} color={state.propertyType === pt.id ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
              </View>
              <Text style={[styles.optionLabel, state.propertyType === pt.id ? styles.optionLabelActive : null]}>{pt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );

    const renderAgentDetails = () => (
      <>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>LICENSE NUMBER</Text>
          <View style={styles.inputWrap}>
            <Feather name="hash" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.input}
              placeholder="Required"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={state.licenseNumber}
              onChangeText={(v) => updateState({ licenseNumber: v })}
              autoCapitalize="characters"
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>AGENCY NAME (OPTIONAL)</Text>
          <View style={styles.inputWrap}>
            <Feather name="briefcase" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.input}
              placeholder="Your agency"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={state.agencyName}
              onChangeText={(v) => updateState({ agencyName: v })}
            />
          </View>
        </View>
      </>
    );

    const renderCompanyDetails = () => (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>NUMBER OF PROPERTIES (OPTIONAL)</Text>
        <View style={styles.countChipRow}>
          {PROPERTY_COUNTS.map((count) => (
            <Pressable
              key={count}
              style={[styles.countChip, state.propertyCount === count ? styles.countChipActive : null]}
              onPress={() => updateState({ propertyCount: count })}
            >
              <Text style={[styles.countChipText, state.propertyCount === count ? styles.countChipTextActive : null]}>{count}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );

    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepTopBar}>
          <View style={styles.topBarSpacer} />
          <ProgressDots />
          <View style={styles.topBarSpacer} />
        </View>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headline}>{headlines[state.accountType!]}</Text>
          <View style={styles.formFields}>
            {state.accountType === 'renter' ? renderRenterDetails() : null}
            {state.accountType === 'individual' ? renderIndividualDetails() : null}
            {state.accountType === 'agent' ? renderAgentDetails() : null}
            {state.accountType === 'company' ? renderCompanyDetails() : null}
          </View>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#ff6b5b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Pressable onPress={handleDetailsSubmit}>
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  const renderPhoto = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepTopBar}>
        <View style={styles.topBarSpacer} />
        <ProgressDots />
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.headline}>Add a photo</Text>
        <Text style={styles.subheadline}>Help others recognize you</Text>
        <Pressable style={styles.photoCircle} onPress={handlePhotoUpload}>
          {state.profilePhoto ? (
            <View style={styles.photoPreview}>
              <Feather name="check" size={40} color="#22C55E" />
              <Text style={styles.photoAddedText}>Photo added</Text>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Feather name="camera" size={40} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </Pressable>
        <Pressable onPress={handlePhotoUpload} style={styles.photoActionBtn}>
          <Feather name="image" size={16} color="#FFFFFF" />
          <Text style={styles.photoActionText}>Choose from Library</Text>
        </Pressable>
        <Pressable onPress={goForward} hitSlop={8} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderComplete = () => {
    const subheadlines: Record<AccountType, string> = {
      renter: 'Start finding your perfect roommate',
      individual: "Let's set up your first listing",
      agent: 'Your professional dashboard is ready',
      company: 'Manage your portfolio with ease',
    };
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepTopBar}>
          <View style={styles.topBarSpacer} />
          <ProgressDots />
          <View style={styles.topBarSpacer} />
        </View>
        <View style={[styles.stepContent, styles.stepContentCenter]}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={48} color="#22C55E" />
          </View>
          <Text style={styles.headline}>You're all set!</Text>
          <Text style={styles.subheadline}>{subheadlines[state.accountType!]}</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Feather name="user" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.summaryLabel}>Account</Text>
              <Text style={styles.summaryValue}>{ACCOUNT_TYPES.find(t => t.id === state.accountType)?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="map-pin" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.summaryLabel}>Location</Text>
              <Text style={styles.summaryValue}>{state.city || 'Not set'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="mail" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.summaryLabel}>Email</Text>
              <Text style={styles.summaryValue}>{state.email}</Text>
            </View>
          </View>
          <Pressable onPress={handleComplete} disabled={isLoading} style={{ width: '100%', opacity: isLoading ? 0.5 : 1 }}>
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.continueBtn, { marginTop: 32 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.continueBtnText}>Let's Go</Text>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  const combinedTransform = Animated.add(slideAnim, dragAnim);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        style={[styles.animatedWrap, { transform: [{ translateX: currentStep > 0 ? combinedTransform : slideAnim }] }]}
        {...(currentStep > 0 ? panResponder.panHandlers : {})}
      >
        {renderStep()}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
  },
  animatedWrap: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  stepContentCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepFooter: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotComplete: {
    backgroundColor: 'rgba(255,107,91,0.5)',
  },
  dotActive: {
    backgroundColor: '#ff6b5b',
    width: 20,
    borderRadius: 4,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  typeCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 16,
  },
  hostOnlyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hostOnlyBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.3,
  },
  agentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  agentNoticeText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
    lineHeight: 17,
  },
  formFields: {
    gap: 14,
    marginBottom: 18,
    marginTop: 8,
  },
  nameRow: {
    flexDirection: 'row' as const,
    gap: 0,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#ff6b5b',
    flex: 1,
  },
  continueBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  orText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  switchLink: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  switchLinkBold: {
    fontWeight: '700',
    color: '#ff6b5b',
  },
  switchRowCenter: {
    alignItems: 'center',
    marginTop: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  cityScroll: {
    flex: 1,
  },
  cityChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cityChipActive: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderColor: '#ff6b5b',
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  cityChipTextActive: {
    color: '#FFFFFF',
  },
  optionsList: {
    gap: 12,
    marginTop: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  optionCardActive: {
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderColor: '#ff6b5b',
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  optionLabelActive: {
    color: '#FFFFFF',
  },
  countChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  countChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  countChipActive: {
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderColor: '#ff6b5b',
  },
  countChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  countChipTextActive: {
    color: '#FFFFFF',
  },
  photoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 32,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoAddedText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  photoActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  skipLinkText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    width: 70,
  },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
