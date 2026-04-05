import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Alert,
  Linking,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { RhomeLogo } from '../../components/RhomeLogo';
import * as ImagePicker from 'expo-image-picker';
import { LocationStep } from './components/LocationStep';
import { PreferencesStep } from './components/PreferencesStep';
import OnboardingHeader from '../../components/OnboardingHeader';
import { getStateNameFromCode } from '../../utils/locationData';
import { saveReferralCode } from '../../services/affiliateService';
import { isPersonalEmail } from '../../constants/blockedEmailDomains';

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
  locationState: string;
  locationBorough: string;
  locationNeighborhood: string;
  locationLat: number;
  locationLng: number;
  licenseNumber: string;
  licensePhoto: string | null;
  licensePhotoValidation: 'none' | 'scanning' | 'valid' | 'expired' | 'unreadable';
  licenseExpirationDate: string | null;
  agencyName: string;
  companyName: string;
  propertyCount: string;
  budgetMin: number;
  budgetMax: number;
  roomType: string;
  propertyType: string;
  profilePhoto: string | null;
  referralCode: string;
}

const PROPERTY_TYPES = [
  { id: 'apartment', icon: 'home', label: 'Apartment' },
  { id: 'house', icon: 'home', label: 'House' },
  { id: 'condo', icon: 'grid', label: 'Condo' },
  { id: 'townhouse', icon: 'layers', label: 'Townhouse' },
  { id: 'studio', icon: 'square', label: 'Studio' },
];

const ACCOUNT_TYPES: { id: AccountType; icon: string; label: string; description: string; color: string }[] = [
  { id: 'renter', icon: 'search', label: 'Renter', description: "I'm looking for a place to rent", color: '#6C63FF' },
  { id: 'individual', icon: 'key', label: 'Host', description: 'I rent out my own property', color: '#3B82F6' },

  { id: 'agent', icon: 'briefcase', label: 'Agent', description: "I'm a licensed real estate agent", color: '#F59E0B' },
  { id: 'company', icon: 'grid', label: 'Company', description: 'I manage properties for clients', color: '#22C55E' },
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
    locationState: '',
    locationBorough: '',
    locationNeighborhood: '',
    locationLat: 0,
    locationLng: 0,
    licenseNumber: '',
    licensePhoto: null,
    licensePhotoValidation: 'none',
    licenseExpirationDate: null,
    agencyName: '',
    companyName: '',
    propertyCount: '',
    budgetMin: 800,
    budgetMax: 2000,
    roomType: '',
    propertyType: '',
    profilePhoto: null,
    referralCode: '',
  });

  type StepId = 'accountType' | 'credentials' | 'location' | 'details' | 'complete';

  const getSteps = (): StepId[] => {
    if (state.accountType === 'renter') {
      return ['accountType', 'credentials', 'location', 'complete'];
    }
    return ['accountType', 'credentials', 'location', 'details', 'complete'];
  };

  const steps = getSteps();
  const currentStepId = steps[currentStep] || 'accountType';
  const totalProgressSteps = steps.length - 1;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agentNotice, setAgentNotice] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [personalEmailBlocked, setPersonalEmailBlocked] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);

  useEffect(() => {
    if (currentStepId === 'complete' && state.accountType === 'renter' && !isLoading && !autoCompleting) {
      setAutoCompleting(true);
      handleComplete();
    }
  }, [currentStepId]);

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

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Agent/Company Account Verification Request');
    const body = encodeURIComponent(
      `Hi Rhome Support,\n\nI'd like to sign up as an agent/company but I don't have a company email.\n\nName: ${state.firstName} ${state.lastName}\nCompany/Brokerage: \nLicense Number: \nPhone: \nEmail I'd like to use: ${state.email}\n\nThank you!`
    );
    Linking.openURL(`mailto:hello@rhomeapp.io?subject=${subject}&body=${body}`);
  };

  const handleCredentialsSubmit = async () => {
    setError('');
    setPersonalEmailBlocked(false);
    if (!state.firstName.trim()) { setError('Please enter your first name'); return; }
    if (!state.lastName.trim()) { setError('Please enter your last name'); return; }
    if (state.accountType === 'company' && !state.companyName.trim()) { setError('Please enter your company name'); return; }
    if (!state.email.trim()) { setError('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) { setError('Please enter a valid email'); return; }
    if ((state.accountType === 'agent' || state.accountType === 'company') && isPersonalEmail(state.email.trim())) {
      setPersonalEmailBlocked(true);
      return;
    }
    if (!state.password || state.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    // Duplicate email check happens server-side in supabase.auth.signUp()
    // Pre-checking via users table doesn't work for unauthenticated users (RLS)

    goForward();
  };

  const handleLocationSelect = (location: { state: string; city: string; borough?: string; neighborhood?: string; lat?: number; lng?: number }) => {
    const city = location.city || '';
    const stateVal = location.state || '';
    const displayCity = stateVal ? `${city}, ${stateVal}` : city;

    if (!city.trim()) {
      Alert.alert('Location required', 'Please enter a valid city or neighborhood.');
      return;
    }

    updateState({
      city: displayCity,
      locationState: stateVal,
      locationBorough: location.borough || '',
      locationNeighborhood: location.neighborhood || '',
      locationLat: location.lat || 0,
      locationLng: location.lng || 0,
    });
    setTimeout(goForward, 150);
  };

  const handlePreferencesSubmit = (prefs: { budgetMin: number; budgetMax: number; roomTypes: string[] }) => {
    updateState({ budgetMin: prefs.budgetMin, budgetMax: prefs.budgetMax, roomType: prefs.roomTypes.join(',') });
    goForward();
  };

  const handleLicensePhotoUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        updateState({ licensePhoto: uri, licensePhotoValidation: 'scanning', licenseExpirationDate: null });
        try {
          const scanResult = await scanLicenseExpiration(uri);
          updateState({
            licensePhotoValidation: scanResult.status,
            licenseExpirationDate: scanResult.expirationDate,
          });
        } catch {
          updateState({ licensePhotoValidation: 'unreadable' });
        }
      }
    } catch {
      await showAlert({ title: 'Error', message: 'Could not open photo library', variant: 'warning' });
    }
  };

  const handleRemoveLicensePhoto = () => {
    updateState({ licensePhoto: null, licensePhotoValidation: 'none', licenseExpirationDate: null });
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const role = state.accountType === 'renter' ? 'renter' : 'host';
      const hostType = state.accountType === 'renter' ? null : (state.accountType as 'individual' | 'agent' | 'company');
      const companyName = state.accountType === 'company' && state.companyName.trim() ? state.companyName.trim() : undefined;
      const fullName = `${state.firstName.trim()} ${state.lastName.trim()}`;
      await register(state.email.trim().toLowerCase(), state.password, fullName, role as any, hostType, companyName, state.firstName.trim(), state.lastName.trim());
      try {
        const { supabase: sb } = await import('../../lib/supabase');
        const { data: { user: authUser } } = await sb.auth.getUser();
        if (authUser && state.city) {
          await sb.from('users').update({
            city: state.city,
            state: state.locationState,
            neighborhood: state.locationNeighborhood,
            borough: state.locationBorough,
            lat: state.locationLat,
            lng: state.locationLng,
          }).eq('id', authUser.id);
        }
      } catch (_) {}
      if (state.profilePhoto) {
        try {
          const { supabase, isSupabaseConfigured } = await import('../../lib/supabase');
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser && isSupabaseConfigured) {
            const rawExt = state.profilePhoto.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
            const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
            const filePath = `${authUser.id}/profile.${ext}`;
            const response = await fetch(state.profilePhoto);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();
            const { error: uploadErr } = await supabase.storage
              .from('avatars')
              .upload(filePath, arrayBuffer, {
                contentType: `image/${ext}`,
                upsert: true,
              });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
              if (urlData?.publicUrl) {
                await supabase.from('users').update({
                  avatar_url: urlData.publicUrl,
                  photos: [urlData.publicUrl],
                }).eq('id', authUser.id);
              }
            } else {
              console.warn('[SignUp] Profile photo upload failed:', uploadErr.message);
              const { Alert } = require('react-native');
              Alert.alert(
                'Photo Upload Issue',
                'Your profile photo couldn\'t be uploaded. You can add it later in your profile settings.',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (photoErr) {
          console.warn('[SignUp] Profile photo save failed:', photoErr);
        }
      }
      if (state.accountType === 'agent' && state.licensePhoto) {
        try {
          const { supabase, isSupabaseConfigured } = await import('../../lib/supabase');
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser && isSupabaseConfigured) {
            const ext = state.licensePhoto.split('.').pop()?.toLowerCase() || 'jpg';
            const filePath = `${authUser.id}/license.${ext}`;
            const response = await fetch(state.licensePhoto);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();
            const { error: uploadErr } = await supabase.storage
              .from('license-documents')
              .upload(filePath, arrayBuffer, {
                contentType: `image/${ext}`,
                upsert: true,
              });
            if (!uploadErr) {
              await supabase.from('users').update({ license_document_url: filePath }).eq('id', authUser.id);
            }
          }
        } catch (_) {}
      }
      if (state.referralCode.trim()) {
        try {
          const { supabase } = await import('../../lib/supabase');
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await saveReferralCode(authUser.id, state.referralCode.trim());
          }
        } catch (_) {}
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        await showAlert({ title: 'Account Exists', message: 'An account with this email already exists. Please sign in instead.', variant: 'info' });
      } else {
        await showAlert({ title: 'Error', message: msg || 'Failed to create account. Please try again.', variant: 'warning' });
      }
    } finally {
      setIsLoading(false);
    }
  };


  const renderStep = () => {
    switch (currentStepId) {
      case 'accountType': return renderAccountType();
      case 'credentials': return renderCredentials();
      case 'location': return renderLocation();
      case 'details': return renderDetails();
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
        <OnboardingHeader
          showBack={currentStep > 0}
          onBack={goBack}
          step={currentStep}
          totalSteps={totalProgressSteps}
        />
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
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={state.firstName}
                    onChangeText={(v) => updateState({ firstName: v })}
                    autoCapitalize="words"
                  />
                  <View style={styles.inputIconLeft} pointerEvents="none">
                    <Feather name="user" size={16} color="rgba(255,255,255,0.35)" />
                  </View>
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
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Skyline Property Group"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={state.companyName}
                    onChangeText={(v) => updateState({ companyName: v })}
                    autoCapitalize="words"
                  />
                  <View style={styles.inputIconLeft} pointerEvents="none">
                    <Feather name="briefcase" size={16} color="rgba(255,255,255,0.35)" />
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={state.email}
                  onChangeText={(v) => updateState({ email: v })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.inputIconLeft} pointerEvents="none">
                  <Feather name="mail" size={16} color="rgba(255,255,255,0.35)" />
                </View>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="Create a password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={state.password}
                  onChangeText={(v) => updateState({ password: v })}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <View style={styles.inputIconLeft} pointerEvents="none">
                  <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" />
                </View>
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.inputIconRight} hitSlop={8}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.35)" />
                </Pressable>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>REFERRAL CODE (OPTIONAL)</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. RHOME-X7K2"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={state.referralCode}
                  onChangeText={(v) => updateState({ referralCode: v.toUpperCase() })}
                  autoCapitalize="characters"
                />
                <View style={styles.inputIconLeft} pointerEvents="none">
                  <Feather name="gift" size={16} color="rgba(255,255,255,0.35)" />
                </View>
              </View>
            </View>
          </View>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#ff6b5b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {personalEmailBlocked ? (
            <View style={styles.blockedEmailCard}>
              <View style={styles.blockedEmailIconWrap}>
                <Feather name="briefcase" size={28} color="#ff6b5b" />
              </View>
              <Text style={styles.blockedEmailTitle}>Company Email Required</Text>
              <Text style={styles.blockedEmailDesc}>
                To sign up as {state.accountType === 'company' ? 'a company' : 'an agent'}, please use your business email address (e.g., name@yourbrokerage.com).
              </Text>
              <Text style={styles.blockedEmailSubtext}>
                This helps us verify your identity and build trust with renters on the platform.
              </Text>
              <Pressable style={styles.blockedEmailSupportBtn} onPress={handleContactSupport}>
                <Feather name="mail" size={16} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockedEmailSupportTitle}>Contact Support</Text>
                  <Text style={styles.blockedEmailSupportSub}>Don't have a company email? We can verify your account manually.</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.blockedEmailBackBtn}
                onPress={() => {
                  setPersonalEmailBlocked(false);
                  updateState({ email: '' });
                }}
              >
                <Feather name="arrow-left" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.blockedEmailBackText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <>
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
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>
              <View style={styles.socialRow}>
                <Pressable style={styles.socialIconBtn} onPress={() => showAlert({ title: 'Google Sign In', message: 'Google authentication will be available in a future update.', variant: 'info' })}>
                  <Image source={require('../../assets/icons/google.png')} style={styles.googleIcon} resizeMode="contain" />
                </Pressable>
                {Platform.OS !== 'android' ? (
                  <Pressable style={styles.socialIconBtn} onPress={() => showAlert({ title: 'Apple Sign In', message: 'Apple authentication will be available in a future update.', variant: 'info' })}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FFFFFF">
                      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z" />
                    </Svg>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={onBackToLogin} hitSlop={8} style={styles.switchRowCenter}>
                <Text style={styles.switchLink}>Already have an account? <Text style={styles.switchLinkBold}>Sign In</Text></Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderLocation = () => (
    <View style={styles.stepContainer}>
      <OnboardingHeader
        showBack={currentStep > 0}
        onBack={goBack}
        step={currentStep}
        totalSteps={totalProgressSteps}
      />
      <LocationStep
        accountType={state.accountType!}
        onLocationSelect={handleLocationSelect}
      />
    </View>
  );

  const handleDetailsSubmit = () => {
    setError('');
    if (state.accountType === 'agent' && !state.licenseNumber.trim()) {
      setError('License number is required');
      return;
    }
    if (state.accountType === 'agent' && !state.agencyName.trim()) {
      setError('Agency name is required');
      return;
    }
    if (state.accountType === 'agent' && !state.licensePhoto) {
      setError('Please upload a photo of your license ID');
      return;
    }
    if (state.accountType === 'agent' && state.licensePhotoValidation === 'scanning') {
      setError('Please wait while Pi verifies your license');
      return;
    }
    if (state.accountType === 'agent' && state.licensePhotoValidation === 'expired') {
      setError('Your license appears to be expired. Please upload a current license.');
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
            <TextInput
              style={styles.input}
              placeholder="Required"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={state.licenseNumber}
              onChangeText={(v) => updateState({ licenseNumber: v })}
              autoCapitalize="characters"
            />
            <View style={styles.inputIconLeft} pointerEvents="none">
              <Feather name="hash" size={16} color="rgba(255,255,255,0.35)" />
            </View>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>AGENCY NAME</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Required"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={state.agencyName}
              onChangeText={(v) => updateState({ agencyName: v })}
            />
            <View style={styles.inputIconLeft} pointerEvents="none">
              <Feather name="briefcase" size={16} color="rgba(255,255,255,0.35)" />
            </View>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>LICENSE ID PHOTO</Text>
          <Text style={licenseStyles.fieldHint}>Upload a photo of your real estate license. Pi will verify it.</Text>
          {state.licensePhoto ? (
            <View style={licenseStyles.photoContainer}>
              <Image source={{ uri: state.licensePhoto }} style={licenseStyles.photoPreview} resizeMode="cover" />
              <Pressable style={licenseStyles.removeBtn} onPress={handleRemoveLicensePhoto}>
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
              {state.licensePhotoValidation === 'scanning' ? (
                <View style={licenseStyles.statusBadge}>
                  <ActivityIndicator size="small" color="#ff6b5b" />
                  <Text style={licenseStyles.statusText}>Pi is scanning your license...</Text>
                </View>
              ) : state.licensePhotoValidation === 'valid' ? (
                <View style={[licenseStyles.statusBadge, licenseStyles.statusValid]}>
                  <Feather name="check-circle" size={14} color="#22C55E" />
                  <Text style={[licenseStyles.statusText, { color: '#22C55E' }]}>
                    Valid{state.licenseExpirationDate ? ` — Expires ${state.licenseExpirationDate}` : ''}
                  </Text>
                </View>
              ) : state.licensePhotoValidation === 'expired' ? (
                <View style={[licenseStyles.statusBadge, licenseStyles.statusExpired]}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={[licenseStyles.statusText, { color: '#EF4444' }]}>
                    License expired{state.licenseExpirationDate ? ` on ${state.licenseExpirationDate}` : ''}
                  </Text>
                </View>
              ) : state.licensePhotoValidation === 'unreadable' ? (
                <View style={[licenseStyles.statusBadge, licenseStyles.statusWarning]}>
                  <Feather name="alert-triangle" size={14} color="#F59E0B" />
                  <Text style={[licenseStyles.statusText, { color: '#F59E0B' }]}>Could not read expiration date. You may continue.</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable style={licenseStyles.uploadBtn} onPress={handleLicensePhotoUpload}>
              <View style={licenseStyles.uploadIconWrap}>
                <Feather name="camera" size={24} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={licenseStyles.uploadText}>Tap to upload license photo</Text>
            </Pressable>
          )}
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
        <OnboardingHeader
          showBack={currentStep > 0}
          onBack={goBack}
          step={currentStep}
          totalSteps={totalProgressSteps}
        />
        {state.accountType === 'renter' ? (
          <PreferencesStep onSubmit={handlePreferencesSubmit} />
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.headline}>{headlines[state.accountType!]}</Text>
            <View style={styles.formFields}>
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
        )}
      </View>
    );
  };

  const renderComplete = () => {
    const subheadlines: Record<AccountType, string> = {
      renter: 'Start finding your perfect roommate',
      individual: "Let's set up your first listing",
      agent: 'Your professional dashboard is ready',
      company: 'Manage your portfolio with ease',
    };
    return (
      <View style={styles.stepContainer}>
        <OnboardingHeader
          showBack={false}
          step={currentStep}
          totalSteps={totalProgressSteps}
        />
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

async function scanLicenseExpiration(
  imageUri: string
): Promise<{ status: 'valid' | 'expired' | 'unreadable'; expirationDate: string | null }> {
  try {
    const { isSupabaseConfigured } = await import('../../lib/supabase');
    if (isSupabaseConfigured) {
      const { supabase } = await import('../../lib/supabase');

      let base64Data: string | null = null;
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
          reader.readAsDataURL(blob);
        });
      } catch {}

      const { data, error } = await supabase.functions.invoke('scan-license-expiration', {
        body: { imageBase64: base64Data },
      });
      if (!error && data?.expirationDate) {
        const expDate = new Date(data.expirationDate);
        const now = new Date();
        return {
          status: expDate > now ? 'valid' : 'expired',
          expirationDate: data.expirationDate,
        };
      }
      if (!error && data?.status === 'unreadable') {
        return { status: 'unreadable', expirationDate: null };
      }
    }
  } catch {}

  const isDev = __DEV__;
  if (isDev) {
    await new Promise(r => setTimeout(r, 1500));
    return { status: 'unreadable', expirationDate: null };
  }

  return { status: 'unreadable', expirationDate: null };
}

const licenseStyles = StyleSheet.create({
  fieldHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 12,
    lineHeight: 18,
  },
  uploadBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  uploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  photoContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  statusValid: {
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  statusExpired: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  statusWarning: {
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
});

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
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  input: {
    width: '100%' as const,
    paddingVertical: 14,
    paddingLeft: 40,
    paddingRight: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
  },
  inputIconLeft: {
    position: 'absolute' as const,
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
  },
  inputIconRight: {
    position: 'absolute' as const,
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    padding: 4,
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
    justifyContent: 'center',
    gap: 16,
    marginBottom: 26,
  },
  socialIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
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
  blockedEmailCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  blockedEmailIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  blockedEmailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  blockedEmailDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  blockedEmailSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  blockedEmailSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 12,
  },
  blockedEmailSupportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blockedEmailSupportSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  blockedEmailBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  blockedEmailBackText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});
