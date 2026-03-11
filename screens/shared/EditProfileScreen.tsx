import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { calculateZodiacFromBirthday } from '../../utils/zodiacUtils';
import { updateUser as supabaseUpdateUser, updateProfile as supabaseUpdateProfile, uploadProfilePhoto } from '../../services/profileService';
import { DatePickerModal } from '../../components/DatePickerModal';
import { formatDate, isAtLeast18, getTierLimit } from '../../utils/dateUtils';
import { TagSelector } from '../../components/TagSelector';

const DraggablePhoto = ({ photo, index, photos, theme, onRemove, onReorder }: any) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, removed);
    onReorder(newPhotos);
  };

  const longPress = Gesture.LongPress()
    .minDuration(200)
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.1);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  const pan = Gesture.Pan()
    .onChange((event) => {
      if (isDragging.value) {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (isDragging.value) {
        const photoWidth = 120 + Spacing.md;
        const movedBy = Math.round(event.translationX / photoWidth);
        const newIndex = index + movedBy;
        
        if (newIndex >= 0 && newIndex < photos.length && movedBy !== 0) {
          runOnJS(handleReorder)(index, newIndex);
        }
      }
      
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      isDragging.value = false;
    });

  const gesture = Gesture.Simultaneous(longPress, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isDragging.value ? 999 : 1,
    opacity: isDragging.value ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.photoWrapper, animatedStyle]}>
        <Image source={{ uri: photo }} style={styles.photoPreview} />
        {index === 0 ? (
          <View style={[styles.mainBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={[Typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>
              Main
            </ThemedText>
          </View>
        ) : null}
        <Pressable
          style={[styles.removePhotoButton, { backgroundColor: theme.error }]}
          onPress={() => {
            console.log('[DraggablePhoto] Remove button clicked, index:', index);
            onRemove(index);
          }}
        >
          <Feather name="x" size={16} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export const EditProfileScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  
  const [photos, setPhotos] = useState<string[]>(user?.photos || [user?.profilePicture].filter(Boolean) as string[] || []);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [birthdayError, setBirthdayError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  useEffect(() => {
    console.log('[EditProfileScreen] User object changed:', {
      userId: user?.id,
      photosCount: user?.photos?.length || 0,
      photos: user?.photos,
      profilePicture: user?.profilePicture,
    });
    if (user?.photos && user.photos.length > 0) {
      console.log('[EditProfileScreen] Setting photos from user.photos:', user.photos);
      setPhotos(user.photos);
    } else if (user?.profilePicture) {
      console.log('[EditProfileScreen] Setting photos from profilePicture:', [user.profilePicture]);
      setPhotos([user.profilePicture]);
    }
  }, [user?.photos, user?.profilePicture]);
  const [bio, setBio] = useState(user?.profileData?.bio || '');
  const [budget, setBudget] = useState(user?.profileData?.budget?.toString() || '');
  const [lookingFor, setLookingFor] = useState<'room' | 'entire_apartment'>(user?.profileData?.lookingFor || 'room');
  const [location, setLocation] = useState(user?.profileData?.location || '');
  const [occupation, setOccupation] = useState(user?.profileData?.occupation || '');
  const [interests, setInterests] = useState<string[]>(
    Array.isArray(user?.profileData?.interests) ? user.profileData.interests : []
  );
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>(user?.profileData?.gender);
  
  const [sleepSchedule, setSleepSchedule] = useState<'early_sleeper' | 'late_sleeper' | 'flexible' | 'irregular'>(user?.profileData?.preferences?.sleepSchedule || 'flexible');
  const [cleanliness, setCleanliness] = useState<'very_tidy' | 'moderately_tidy' | 'relaxed'>(user?.profileData?.preferences?.cleanliness || 'moderately_tidy');
  const [guestPolicy, setGuestPolicy] = useState<'rarely' | 'occasionally' | 'frequently' | 'prefer_no_guests'>(user?.profileData?.preferences?.guestPolicy || 'occasionally');
  const [noiseTolerance, setNoiseTolerance] = useState<'prefer_quiet' | 'normal_noise' | 'loud_environments'>(user?.profileData?.preferences?.noiseTolerance || 'normal_noise');
  const [smoking, setSmoking] = useState<'yes' | 'no' | 'only_outside'>(user?.profileData?.preferences?.smoking || 'no');
  const [workLocation, setWorkLocation] = useState<'wfh_fulltime' | 'hybrid' | 'office_fulltime' | 'irregular'>(user?.profileData?.preferences?.workLocation || 'hybrid');
  const [roommateRelationship, setRoommateRelationship] = useState<'respectful_coliving' | 'occasional_hangouts' | 'prefer_friends' | 'minimal_interaction'>(user?.profileData?.preferences?.roommateRelationship || 'respectful_coliving');
  const [pets, setPets] = useState<'have_pets' | 'open_to_pets' | 'no_pets'>(user?.profileData?.preferences?.pets || 'open_to_pets');
  const [expenseUtilities, setExpenseUtilities] = useState<'split_equally' | 'usage_based' | 'included_in_rent'>(user?.profileData?.preferences?.sharedExpenses?.utilities || 'split_equally');
  const [expenseGroceries, setExpenseGroceries] = useState<'split_equally' | 'buy_own' | 'shared_basics'>(user?.profileData?.preferences?.sharedExpenses?.groceries || 'buy_own');
  const [expenseInternet, setExpenseInternet] = useState<'split_equally' | 'one_pays' | 'included_in_rent'>(user?.profileData?.preferences?.sharedExpenses?.internet || 'split_equally');
  const [expenseCleaning, setExpenseCleaning] = useState<'split_equally' | 'take_turns' | 'hire_cleaner'>(user?.profileData?.preferences?.sharedExpenses?.cleaning || 'split_equally');
  const [moveInDate, setMoveInDate] = useState(user?.profileData?.preferences?.moveInDate || '');
  const [showMoveInPicker, setShowMoveInPicker] = useState(false);
  const [bedrooms, setBedrooms] = useState(user?.profileData?.preferences?.bedrooms?.toString() || '');
  
  const [isSaving, setIsSaving] = useState(false);

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
            if (imageUrl) {
              setPhotos([...photos, imageUrl]);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      if (permissionResult.canAskAgain === false) {
        Alert.alert(
          'Permission Required',
          'Photo library access is disabled. Please enable it in your device settings to add photos.',
          [
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert(
          'Permission Required',
          'Permission to access photo library is required to add photos.',
          [
            { text: 'OK' },
          ]
        );
      }
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
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      console.error('Image picker error:', error);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };


  const validateBirthday = (dateString: string): { valid: boolean; error: string } => {
    if (!dateString.trim()) return { valid: false, error: 'Please select your date of birth' };
    if (!isAtLeast18(dateString)) return { valid: false, error: 'You must be at least 18 years old' };
    return { valid: true, error: '' };
  };

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

    const birthdayValidation = validateBirthday(birthday);
    if (!birthdayValidation.valid) {
      setBirthdayError(birthdayValidation.error);
      Alert.alert('Error', birthdayValidation.error);
      return;
    }

    setIsSaving(true);

    const birthdayStorageFormat = birthday.trim() || user?.birthday;
    const zodiacSign = birthdayStorageFormat ? calculateZodiacFromBirthday(birthdayStorageFormat) : undefined;
    
    console.log('[EditProfileScreen] Saving profile with photos:', photos);
    console.log('[EditProfileScreen] Calculated zodiac sign from birthday:', { birthday: birthdayStorageFormat, zodiacSign });

    try {
      const uploadedPhotoUrls: string[] = [];
      for (const photo of photos) {
        if (photo.startsWith('data:') || photo.startsWith('file://') || photo.startsWith('content://')) {
          try {
            const fileName = `photo_${Date.now()}_${uploadedPhotoUrls.length}.jpg`;
            const url = await uploadProfilePhoto(photo, fileName);
            uploadedPhotoUrls.push(url);
          } catch (uploadErr) {
            console.warn('[EditProfileScreen] Photo upload failed, keeping local URI:', uploadErr);
            uploadedPhotoUrls.push(photo);
          }
        } else {
          uploadedPhotoUrls.push(photo);
        }
      }

      await supabaseUpdateUser({
        full_name: name.trim(),
        avatar_url: uploadedPhotoUrls[0] || undefined,
        bio: bio.trim() || undefined,
        birthday: birthdayStorageFormat,
        zodiac_sign: zodiacSign,
        gender,
        occupation: occupation.trim() || undefined,
        location: location.trim() || undefined,
      });

      await supabaseUpdateProfile({
        budget_min: budget.trim() ? parseInt(budget) : undefined,
        looking_for: lookingFor,
        interests: interests.length > 0 ? interests : undefined,
        photos: uploadedPhotoUrls,
        sleep_schedule: sleepSchedule,
        cleanliness: cleanliness === 'very_tidy' ? 5 : cleanliness === 'moderately_tidy' ? 3 : 1,
        noise_tolerance: noiseTolerance === 'prefer_quiet' ? 1 : noiseTolerance === 'normal_noise' ? 3 : 5,
        pets,
        smoking: smoking === 'yes',
        guests: guestPolicy,
        work_location: workLocation,
        move_in_date: moveInDate.trim() || undefined,
        bathrooms: bedrooms.trim() ? parseInt(bedrooms) : undefined,
      });

      console.log('[EditProfileScreen] Supabase profile updated successfully');
    } catch (supabaseError) {
      console.warn('[EditProfileScreen] Supabase update failed, falling back to local storage:', supabaseError);
    }
    
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
        location: location.trim() || undefined,
        occupation: occupation.trim() || undefined,
        interests: interests.length > 0 ? interests : undefined,
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
    console.log('[EditProfileScreen] Profile saved successfully');

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

        <ThemedText style={[Typography.h1, { marginBottom: Spacing.xl }]}>Edit Profile</ThemedText>

        {/* Profile Photos */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Profile Photos</ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            Add up to 6 photos. Long press and drag to reorder. Your first photo will be your main profile picture.
          </ThemedText>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.photosScroll}
            contentContainerStyle={styles.photosContainer}
          >
            {photos.map((photo, index) => (
              <DraggablePhoto
                key={photo}
                photo={photo}
                index={index}
                photos={photos}
                theme={theme}
                onRemove={removePhoto}
                onReorder={setPhotos}
              />
            ))}
            
            {photos.length < 6 ? (
              <Pressable
                style={[styles.addPhotoButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={pickImage}
              >
                <Feather name="plus" size={32} color={theme.textSecondary} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                  Add Photo
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
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
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Date of Birth *
            </ThemedText>
            <Pressable
              style={[styles.input, {
                backgroundColor: theme.backgroundSecondary,
                borderColor: birthdayError ? theme.error : theme.border,
                borderWidth: birthdayError ? 2 : 1,
                justifyContent: 'center',
              }]}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={{ color: birthday ? theme.text : theme.textSecondary }}>
                {birthday ? formatDate(birthday) : 'Select your birthday'}
              </ThemedText>
            </Pressable>
            <DatePickerModal
              visible={showDatePicker}
              onClose={() => setShowDatePicker(false)}
              onConfirm={(date) => { setBirthday(date); setBirthdayError(''); }}
              mode="birthday"
              title="Enter Your Birthday"
              initialDate={birthday || undefined}
            />
            {birthdayError ? (
              <ThemedText style={[Typography.caption, { color: theme.error, marginTop: Spacing.xs }]}>
                {birthdayError}
              </ThemedText>
            ) : (
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                Must be 18+ years old
              </ThemedText>
            )}
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

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Location
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
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Interests & Lifestyle
            </ThemedText>
            <TagSelector
              selectedTags={interests}
              onChange={setInterests}
              minTags={3}
              maxTags={10}
              showCount
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Gender
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Male" value="male" isSelected={gender === 'male'} onPress={() => setGender('male')} />
              <OptionButton label="Female" value="female" isSelected={gender === 'female'} onPress={() => setGender('female')} />
              <OptionButton label="Other" value="other" isSelected={gender === 'other'} onPress={() => setGender('other')} />
            </View>
          </View>
        </View>

        {/* About You */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>About You</ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
            Tell us a bit more about yourself
          </ThemedText>

          {/* Sleep Schedule */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What is your sleep schedule?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Early Sleeper / Early Riser" value="early_sleeper" isSelected={sleepSchedule === 'early_sleeper'} onPress={() => setSleepSchedule('early_sleeper')} />
              <OptionButton label="Late Sleeper / Late Riser" value="late_sleeper" isSelected={sleepSchedule === 'late_sleeper'} onPress={() => setSleepSchedule('late_sleeper')} />
              <OptionButton label="Flexible" value="flexible" isSelected={sleepSchedule === 'flexible'} onPress={() => setSleepSchedule('flexible')} />
              <OptionButton label="Irregular" value="irregular" isSelected={sleepSchedule === 'irregular'} onPress={() => setSleepSchedule('irregular')} />
            </View>
          </View>

          {/* Cleanliness */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How clean/tidy are you on a daily basis?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Very Tidy" value="very_tidy" isSelected={cleanliness === 'very_tidy'} onPress={() => setCleanliness('very_tidy')} />
              <OptionButton label="Moderately Tidy" value="moderately_tidy" isSelected={cleanliness === 'moderately_tidy'} onPress={() => setCleanliness('moderately_tidy')} />
              <OptionButton label="Relaxed About Clutter" value="relaxed" isSelected={cleanliness === 'relaxed'} onPress={() => setCleanliness('relaxed')} />
            </View>
          </View>

          {/* Guests */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How often do you have guests over?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Rarely" value="rarely" isSelected={guestPolicy === 'rarely'} onPress={() => setGuestPolicy('rarely')} />
              <OptionButton label="Occasionally" value="occasionally" isSelected={guestPolicy === 'occasionally'} onPress={() => setGuestPolicy('occasionally')} />
              <OptionButton label="Frequently" value="frequently" isSelected={guestPolicy === 'frequently'} onPress={() => setGuestPolicy('frequently')} />
              <OptionButton label="Prefer No Guests" value="prefer_no_guests" isSelected={guestPolicy === 'prefer_no_guests'} onPress={() => setGuestPolicy('prefer_no_guests')} />
            </View>
          </View>

          {/* Noise Tolerance */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What is your noise tolerance?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Prefer Quiet" value="prefer_quiet" isSelected={noiseTolerance === 'prefer_quiet'} onPress={() => setNoiseTolerance('prefer_quiet')} />
              <OptionButton label="Can Handle Normal Noise" value="normal_noise" isSelected={noiseTolerance === 'normal_noise'} onPress={() => setNoiseTolerance('normal_noise')} />
              <OptionButton label="Don't Mind Loud Environments" value="loud_environments" isSelected={noiseTolerance === 'loud_environments'} onPress={() => setNoiseTolerance('loud_environments')} />
            </View>
          </View>

          {/* Smoking */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Do you smoke, vape, or use recreational substances?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Yes" value="yes" isSelected={smoking === 'yes'} onPress={() => setSmoking('yes')} />
              <OptionButton label="No" value="no" isSelected={smoking === 'no'} onPress={() => setSmoking('no')} />
              <OptionButton label="Only Outside" value="only_outside" isSelected={smoking === 'only_outside'} onPress={() => setSmoking('only_outside')} />
            </View>
          </View>

          {/* Work Location */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Do you work from home, office, or hybrid?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Work From Home Full-time" value="wfh_fulltime" isSelected={workLocation === 'wfh_fulltime'} onPress={() => setWorkLocation('wfh_fulltime')} />
              <OptionButton label="Hybrid" value="hybrid" isSelected={workLocation === 'hybrid'} onPress={() => setWorkLocation('hybrid')} />
              <OptionButton label="Office Full-time" value="office_fulltime" isSelected={workLocation === 'office_fulltime'} onPress={() => setWorkLocation('office_fulltime')} />
              <OptionButton label="Irregular Schedule" value="irregular" isSelected={workLocation === 'irregular'} onPress={() => setWorkLocation('irregular')} />
            </View>
          </View>

          {/* Roommate Relationship */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What is your ideal roommate relationship?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Just Respectful Co-living" value="respectful_coliving" isSelected={roommateRelationship === 'respectful_coliving'} onPress={() => setRoommateRelationship('respectful_coliving')} />
              <OptionButton label="Occasional Hangouts" value="occasional_hangouts" isSelected={roommateRelationship === 'occasional_hangouts'} onPress={() => setRoommateRelationship('occasional_hangouts')} />
              <OptionButton label="Prefer to Be Friends" value="prefer_friends" isSelected={roommateRelationship === 'prefer_friends'} onPress={() => setRoommateRelationship('prefer_friends')} />
              <OptionButton label="Prefer Minimal Interaction" value="minimal_interaction" isSelected={roommateRelationship === 'minimal_interaction'} onPress={() => setRoommateRelationship('minimal_interaction')} />
            </View>
          </View>

          {/* Budget */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What is your monthly budget range?
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

          {/* Looking For */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What are you looking for?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Room" value="room" isSelected={lookingFor === 'room'} onPress={() => setLookingFor('room')} />
              <OptionButton label="Entire Apartment" value="entire_apartment" isSelected={lookingFor === 'entire_apartment'} onPress={() => setLookingFor('entire_apartment')} />
            </View>
          </View>

          {/* Move-in Date */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              When are you looking to move in?
            </ThemedText>
            <Pressable
              style={[styles.input, {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                justifyContent: 'center',
              }]}
              onPress={() => setShowMoveInPicker(true)}
            >
              <ThemedText style={{ color: moveInDate ? theme.text : theme.textSecondary }}>
                {moveInDate ? formatDate(moveInDate) : 'Select move-in date'}
              </ThemedText>
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

          {/* Bedrooms */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How many bedrooms are you looking for?
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., 2"
              placeholderTextColor={theme.textSecondary}
              value={bedrooms}
              onChangeText={setBedrooms}
              keyboardType="numeric"
            />
          </View>

          {/* Pets */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Do you have pets, or are you open to living with pets?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="I Have Pets" value="have_pets" isSelected={pets === 'have_pets'} onPress={() => setPets('have_pets')} />
              <OptionButton label="I'm Open to Pets" value="open_to_pets" isSelected={pets === 'open_to_pets'} onPress={() => setPets('open_to_pets')} />
              <OptionButton label="I'm Allergic / Prefer No Pets" value="no_pets" isSelected={pets === 'no_pets'} onPress={() => setPets('no_pets')} />
            </View>
          </View>

        </View>

        {/* Shared Expenses */}
        <View style={styles.section}>
          <ThemedText style={[Typography.h3, styles.sectionTitle]}>Shared Expense Expectations</ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
            Set your expectations for splitting household costs
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How should utilities (electric, gas, water) be handled?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Split Equally" value="split_equally" isSelected={expenseUtilities === 'split_equally'} onPress={() => setExpenseUtilities('split_equally')} />
              <OptionButton label="Based on Usage" value="usage_based" isSelected={expenseUtilities === 'usage_based'} onPress={() => setExpenseUtilities('usage_based')} />
              <OptionButton label="Included in Rent" value="included_in_rent" isSelected={expenseUtilities === 'included_in_rent'} onPress={() => setExpenseUtilities('included_in_rent')} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How should groceries be handled?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Split Equally" value="split_equally" isSelected={expenseGroceries === 'split_equally'} onPress={() => setExpenseGroceries('split_equally')} />
              <OptionButton label="Everyone Buys Their Own" value="buy_own" isSelected={expenseGroceries === 'buy_own'} onPress={() => setExpenseGroceries('buy_own')} />
              <OptionButton label="Share Basics, Buy Own Extras" value="shared_basics" isSelected={expenseGroceries === 'shared_basics'} onPress={() => setExpenseGroceries('shared_basics')} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How should internet / WiFi be handled?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Split Equally" value="split_equally" isSelected={expenseInternet === 'split_equally'} onPress={() => setExpenseInternet('split_equally')} />
              <OptionButton label="One Person Pays" value="one_pays" isSelected={expenseInternet === 'one_pays'} onPress={() => setExpenseInternet('one_pays')} />
              <OptionButton label="Included in Rent" value="included_in_rent" isSelected={expenseInternet === 'included_in_rent'} onPress={() => setExpenseInternet('included_in_rent')} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              How should cleaning supplies be handled?
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Split Equally" value="split_equally" isSelected={expenseCleaning === 'split_equally'} onPress={() => setExpenseCleaning('split_equally')} />
              <OptionButton label="Take Turns Buying" value="take_turns" isSelected={expenseCleaning === 'take_turns'} onPress={() => setExpenseCleaning('take_turns')} />
              <OptionButton label="Hire a Cleaner" value="hire_cleaner" isSelected={expenseCleaning === 'hire_cleaner'} onPress={() => setExpenseCleaning('hire_cleaner')} />
            </View>
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
  photosScroll: {
    marginHorizontal: -Spacing.lg,
  },
  photosContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  photoWrapper: {
    position: 'relative',
    width: 120,
    height: 150,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.medium,
  },
  mainBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  addPhotoButton: {
    width: 120,
    height: 150,
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtons: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    pointerEvents: 'box-none',
  },
  reorderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  zodiacOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  birthdayInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  birthdayInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    fontSize: 16,
    borderWidth: 1,
  },
  calendarButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
