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
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState(() => {
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
      }
    }
    return new Date(2000, 0, 1);
  });
  
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


  const toggleLifestyle = (item: 'active_gym' | 'homebody' | 'nightlife_social' | 'quiet_introverted' | 'creative_artistic' | 'professional_focused') => {
    if (lifestyle.includes(item)) {
      setLifestyle(lifestyle.filter(l => l !== item));
    } else {
      if (lifestyle.length < 3) {
        setLifestyle([...lifestyle, item]);
      } else {
        Alert.alert('Maximum Reached', 'You can select up to 3 lifestyle choices');
      }
    }
  };

  const validateBirthday = (dateString: string): { valid: boolean; error: string; date?: Date } => {
    if (!dateString.trim()) {
      return { valid: false, error: 'Please enter your date of birth' };
    }

    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dateRegex.test(dateString)) {
      return { valid: false, error: 'Invalid format. Use MM/DD/YYYY (e.g., 08/15/1995)' };
    }

    const [month, day, year] = dateString.split('/').map(num => parseInt(num));
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { valid: false, error: 'Invalid date. Please check the day and month' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      return { valid: false, error: 'Date of birth cannot be in the future' };
    }

    const age = Math.floor((today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) {
      return { valid: false, error: 'You must be at least 18 years old' };
    }

    return { valid: true, error: '', date };
  };

  const convertToStorageFormat = (dateString: string): string => {
    const [month, day, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const handleBirthdayChange = (text: string) => {
    setBirthday(text);
    if (birthdayError) {
      setBirthdayError('');
    }
  };

  const handleBirthdayBlur = () => {
    if (birthday.trim()) {
      const validation = validateBirthday(birthday);
      if (!validation.valid) {
        setBirthdayError(validation.error);
      }
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setDatePickerDate(selectedDate);
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const year = selectedDate.getFullYear();
      const formattedDate = `${month}/${day}/${year}`;
      setBirthday(formattedDate);
      setBirthdayError('');
      
      const validation = validateBirthday(formattedDate);
      if (!validation.valid) {
        setBirthdayError(validation.error);
      }
      console.log('[EditProfileScreen] Birthday set:', formattedDate);
    }
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
    await new Promise(resolve => setTimeout(resolve, 500));

    const birthdayStorageFormat = convertToStorageFormat(birthday);
    const zodiacSign = birthdayStorageFormat ? calculateZodiacFromBirthday(birthdayStorageFormat) : undefined;
    
    console.log('[EditProfileScreen] Saving profile with photos:', photos);
    console.log('[EditProfileScreen] Calculated zodiac sign from birthday:', { birthday: birthdayStorageFormat, zodiacSign });
    
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
            <View style={styles.birthdayInputContainer}>
              <TextInput
                style={[styles.birthdayInput, { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text, 
                  borderColor: birthdayError ? theme.error : theme.border,
                  borderWidth: birthdayError ? 2 : 1
                }]}
                placeholder="MM/DD/YYYY (e.g., 08/15/1995)"
                placeholderTextColor={theme.textSecondary}
                value={birthday}
                onChangeText={handleBirthdayChange}
                onBlur={handleBirthdayBlur}
                keyboardType="numbers-and-punctuation"
              />
              {Platform.OS !== 'web' && (
                <Pressable
                  style={[styles.calendarButton, { backgroundColor: theme.primary }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Feather name="calendar" size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
            {Platform.OS !== 'web' && showDatePicker && (
              <DateTimePicker
                value={datePickerDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            )}
            {birthdayError ? (
              <ThemedText style={[Typography.caption, { color: theme.error, marginTop: Spacing.xs }]}>
                {birthdayError}
              </ThemedText>
            ) : (
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                Must be 18+ years old. Format: MM/DD/YYYY
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
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="MM/DD/YYYY (e.g., 02/01/2025)"
              placeholderTextColor={theme.textSecondary}
              value={moveInDate}
              onChangeText={setMoveInDate}
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

          {/* Lifestyle */}
          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              What describes your lifestyle best? (Choose up to 3)
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
              Selected: {lifestyle.length}/3
            </ThemedText>
            <View style={styles.optionsRow}>
              <OptionButton label="Very Active / Gym" value="active_gym" isSelected={lifestyle.includes('active_gym')} onPress={() => toggleLifestyle('active_gym')} />
              <OptionButton label="Homebody" value="homebody" isSelected={lifestyle.includes('homebody')} onPress={() => toggleLifestyle('homebody')} />
              <OptionButton label="Nightlife / Social" value="nightlife_social" isSelected={lifestyle.includes('nightlife_social')} onPress={() => toggleLifestyle('nightlife_social')} />
              <OptionButton label="Quiet / Introverted" value="quiet_introverted" isSelected={lifestyle.includes('quiet_introverted')} onPress={() => toggleLifestyle('quiet_introverted')} />
              <OptionButton label="Creative / Artistic" value="creative_artistic" isSelected={lifestyle.includes('creative_artistic')} onPress={() => toggleLifestyle('creative_artistic')} />
              <OptionButton label="Professional-focused" value="professional_focused" isSelected={lifestyle.includes('professional_focused')} onPress={() => toggleLifestyle('professional_focused')} />
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
