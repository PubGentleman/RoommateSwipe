import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, TextInput, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { calculateZodiacFromBirthday } from '../../utils/zodiacUtils';
import { updateUser as supabaseUpdateUser, updateProfile as supabaseUpdateProfile, uploadProfilePhoto } from '../../services/profileService';
import { DatePickerModal } from '../../components/DatePickerModal';
import { formatDate, isAtLeast18, getTierLimit } from '../../utils/dateUtils';
import { OccupationBarSelector } from '../../components/OccupationBarSelector';
import { dispatchInsightTrigger } from '../../utils/insightRefresh';
import { InterestCategoryBars } from '../../components/InterestCategoryBars';
import { useConfirm } from '../../contexts/ConfirmContext';

export const EditProfileScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const { alert } = useConfirm();
  
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
  
  const [profileNote, setProfileNote] = useState(user?.profileData?.profileNote || '');
  const [isSaving, setIsSaving] = useState(false);

  const pickImage = async () => {
    if (photos.length >= 6) {
      await alert({ title: 'Maximum Reached', message: 'You can upload up to 6 photos', variant: 'info' });
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
            alert({ title: 'File Too Large', message: 'Please select an image smaller than 10MB', variant: 'warning' });
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
        await alert({
          title: 'Permission Required',
          message: 'Photo library access is disabled. Please enable it in your device settings to add photos.',
          variant: 'warning',
        });
      } else {
        await alert({
          title: 'Permission Required',
          message: 'Permission to access photo library is required to add photos.',
          variant: 'warning',
        });
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
      await alert({ title: 'Error', message: 'Failed to pick image. Please try again.', variant: 'warning' });
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
    if (photos.length < 3) {
      await alert({ title: 'More photos needed', message: `Add at least 3 photos to make your profile visible to matches. You have ${photos.length} so far.`, variant: 'warning' });
      return;
    }

    if (!name.trim()) {
      await alert({ title: 'Error', message: 'Please enter your name', variant: 'warning' });
      return;
    }

    if (!email.trim()) {
      await alert({ title: 'Error', message: 'Please enter your email', variant: 'warning' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await alert({ title: 'Error', message: 'Please enter a valid email address', variant: 'warning' });
      return;
    }

    const birthdayValidation = validateBirthday(birthday);
    if (!birthdayValidation.valid) {
      setBirthdayError(birthdayValidation.error);
      await alert({ title: 'Error', message: birthdayValidation.error, variant: 'warning' });
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
        profile_note: profileNote.trim() || null,
        profile_note_updated_at: profileNote.trim() ? new Date().toISOString() : null,
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
        profileNote: profileNote.trim() || undefined,
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
    dispatchInsightTrigger('profile_change');

    setIsSaving(false);
    await alert({ title: 'Success', message: 'Profile updated successfully', variant: 'success' });
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
            Add up to 6 photos. Use the arrows to reorder. Your first photo is your main profile picture.
          </ThemedText>

          <View style={styles.photoCountRow}>
            <ThemedText style={[styles.photoCountText, { color: theme.textSecondary }]}>
              {photos.length} of 6 photos added
            </ThemedText>
            {photos.length >= 3 ? (
              <View style={styles.photoCountGood}>
                <Feather name="check-circle" size={14} color="#4CAF50" />
                <ThemedText style={styles.photoCountGoodText}>Looking good!</ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.photoCountWarning, { color: '#FF6B6B' }]}>
                Add {3 - photos.length} more to go live
              </ThemedText>
            )}
          </View>

          <View style={styles.photoGrid}>
            {Array.from({ length: 6 }).map((_, index) => {
              const photo = photos[index];
              const isFirst = index === 0;

              if (photo) {
                return (
                  <View key={index} style={styles.photoGridItem}>
                    <Image source={{ uri: photo }} style={styles.photoGridImage} />
                    {isFirst ? (
                      <View style={[styles.mainBadge, { backgroundColor: theme.primary }]}>
                        <ThemedText style={styles.mainBadgeText}>Main</ThemedText>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.removePhotoButton, { backgroundColor: theme.error }]}
                      onPress={() => removePhoto(index)}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.reorderButtons} pointerEvents="box-none">
                      {index > 0 ? (
                        <TouchableOpacity
                          style={[styles.reorderButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                          onPress={() => {
                            const newPhotos = [...photos];
                            const temp = newPhotos[index - 1];
                            newPhotos[index - 1] = newPhotos[index];
                            newPhotos[index] = temp;
                            setPhotos(newPhotos);
                          }}
                        >
                          <Feather name="arrow-left" size={14} color="#fff" />
                        </TouchableOpacity>
                      ) : null}
                      {index < photos.length - 1 ? (
                        <TouchableOpacity
                          style={[styles.reorderButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                          onPress={() => {
                            const newPhotos = [...photos];
                            const temp = newPhotos[index + 1];
                            newPhotos[index + 1] = newPhotos[index];
                            newPhotos[index] = temp;
                            setPhotos(newPhotos);
                          }}
                        >
                          <Feather name="arrow-right" size={14} color="#fff" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              }

              const isNextSlot = index === photos.length;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.photoGridItem,
                    styles.photoGridEmpty,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: isNextSlot ? theme.primary : theme.border,
                      borderStyle: 'dashed',
                      opacity: isNextSlot ? 1 : 0.5,
                    },
                  ]}
                  onPress={isNextSlot ? pickImage : undefined}
                  activeOpacity={isNextSlot ? 0.7 : 1}
                >
                  {isNextSlot ? (
                    <>
                      <Feather name="plus-circle" size={28} color={theme.primary} />
                      <ThemedText style={[styles.addPhotoLabel, { color: theme.primary }]}>Add Photo</ThemedText>
                    </>
                  ) : (
                    <Feather name="image" size={24} color={theme.border} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Instagram Verification */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs }}>
            <Feather name="instagram" size={20} color="#E1306C" />
            <ThemedText style={[Typography.h3, { marginLeft: Spacing.sm }]}>Instagram Verification</ThemedText>
          </View>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            Verified profiles get more matches. Your handle is only shown after a mutual match.
          </ThemedText>

          {user?.profileData?.instagram_verified ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                <Feather name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={[Typography.body, { color: '#4CAF50', marginLeft: Spacing.sm }]}>
                  @{user?.profileData?.instagram_handle} connected
                </ThemedText>
              </View>
              <Pressable
                style={[styles.optionButton, { borderColor: theme.error }]}
                onPress={async () => {
                  const { disconnectInstagram } = await import('../../services/instagramService');
                  await disconnectInstagram();
                  await alert({ title: 'Disconnected', message: 'Instagram has been unlinked from your profile.', variant: 'info' });
                }}
              >
                <ThemedText style={[Typography.small, { color: theme.error }]}>Disconnect</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.optionButton, { backgroundColor: '#E1306C', borderColor: '#E1306C', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }]}
              onPress={async () => {
                const { connectInstagram } = await import('../../services/instagramService');
                const result = await connectInstagram();
                if (result.success) {
                  await alert({ title: 'Connected!', message: `@${result.handle} is now linked to your profile.`, variant: 'success' });
                } else {
                  await alert({ title: 'Error', message: result.error || 'Could not connect Instagram', variant: 'warning' });
                }
              }}
            >
              <Feather name="instagram" size={16} color="#FFFFFF" />
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>Connect Instagram</ThemedText>
            </Pressable>
          )}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                In your own words
              </ThemedText>
              <ThemedText style={[Typography.small, { color: profileNote.length > 450 ? '#ef4444' : theme.textSecondary }]}>
                {profileNote.length}/500
              </ThemedText>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="What do you want roommates to know about you beyond your profile settings? Your real daily habits, your vibe, what living with you is actually like..."
              placeholderTextColor={theme.textSecondary}
              value={profileNote}
              onChangeText={(text) => setProfileNote(text.slice(0, 500))}
              multiline
              maxLength={500}
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Feather name="eye" size={11} color={theme.textSecondary} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>
                Visible to your matches · You control this
              </ThemedText>
            </View>
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
            <ThemedText style={{ fontSize: 13, color: theme.textSecondary, marginBottom: Spacing.sm }}>Select the option that best describes what you do</ThemedText>
            <OccupationBarSelector
              selectedOccupation={occupation}
              onChange={setOccupation}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[Typography.body, { marginBottom: Spacing.sm }]}>
              Interests & Lifestyle
            </ThemedText>
            <InterestCategoryBars
              selectedTags={interests}
              onChange={setInterests}
              maxTags={10}
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
  photoCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  photoCountText: {
    fontSize: 13,
  },
  photoCountGood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoCountGoodText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  photoCountWarning: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoGridItem: {
    width: '31%' as any,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.medium,
    overflow: 'hidden',
    position: 'relative',
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
  },
  photoGridEmpty: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  mainBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.small,
  },
  mainBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reorderButtons: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
