import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, Image, ScrollView, Platform } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { Property, HostSubscriptionData } from '../../types/models';
import { canAddListingCheck } from '../../utils/hostPricing';
import { ListingLimitModal, OverageModal } from '../../components/ListingLimitModal';
import { US_STATES } from '../../utils/locationData';
import { Spacing, BorderRadius } from '../../constants/theme';
import { createListing as createListingSupa, updateListing as updateListingSupa, getListing, deleteListing as deleteListingSupa } from '../../services/listingService';
import { DatePickerModal } from '../../components/DatePickerModal';
import { formatDate } from '../../utils/dateUtils';

type RouteParams = {
  CreateEditListing: { propertyId?: string };
};

const AMENITIES_LIST = [
  'WiFi', 'Parking', 'Laundry', 'AC', 'Heating', 'Dishwasher',
  'Gym', 'Pool', 'Pet Friendly', 'Furnished', 'Balcony', 'Storage',
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const BATHROOM_OPTIONS = [1, 2, 3, 4];

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400',
];

const POPULAR_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Miami', 'San Francisco',
  'Austin', 'Seattle', 'Denver', 'Boston', 'Houston',
];

const SECTION_ICONS: Record<string, string> = {
  'Basic Info': 'file-text',
  'Type': 'home',
  'Location': 'map-pin',
  'Amenities': 'star',
  'House Rules': 'shield',
  'Photos': 'camera',
};

export const CreateEditListingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CreateEditListing'>>();
  const { theme } = useTheme();
  const { user, getHostPlan } = useAuth();

  const propertyId = route.params?.propertyId;
  const isEditing = !!propertyId;
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [sqft, setSqft] = useState('');
  const [propertyType, setPropertyType] = useState<'lease' | 'sublet'>('lease');
  const [roomType, setRoomType] = useState<'room' | 'entire'>('entire');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [showAvailableDatePicker, setShowAvailableDatePicker] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [houseRules, setHouseRules] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [overageMessage, setOverageMessage] = useState('');
  const [overageResolve, setOverageResolve] = useState<((v: boolean) => void) | null>(null);

  useEffect(() => {
    if (isEditing) {
      loadProperty();
    }
    if (user) {
      StorageService.getHostSubscription(user.id).then(sub => setHostSub(sub));
    }
  }, [propertyId, user]);

  const loadProperty = async () => {
    if (!propertyId) return;
    let prop: any = null;
    try {
      const supaListing = await getListing(propertyId);
      if (supaListing) {
        prop = {
          title: supaListing.title || '',
          description: supaListing.description || '',
          price: supaListing.rent || 0,
          bedrooms: supaListing.bedrooms || 1,
          bathrooms: supaListing.bathrooms || 1,
          sqft: supaListing.sqft || 0,
          propertyType: supaListing.property_type || 'lease',
          roomType: supaListing.room_type || 'entire',
          city: supaListing.city || '',
          state: supaListing.state || '',
          neighborhood: supaListing.neighborhood || '',
          address: supaListing.address || '',
          availableDate: supaListing.available_date ? new Date(supaListing.available_date) : undefined,
          amenities: supaListing.amenities || [],
          photos: supaListing.photos || [],
        };
      }
    } catch {
      const properties = await StorageService.getProperties();
      const found = properties.find(p => p.id === propertyId);
      if (found) {
        prop = found;
      }
    }
    if (!prop) return;

    setTitle(prop.title);
    setDescription(prop.description);
    setPrice(prop.price.toString());
    setBedrooms(prop.bedrooms);
    setBathrooms(prop.bathrooms);
    setSqft(prop.sqft.toString());
    setPropertyType(prop.propertyType);
    setRoomType(prop.roomType);
    setCity(prop.city);
    setState(prop.state);
    setNeighborhood(prop.neighborhood || '');
    setAddress(prop.address);
    setAvailableDate(prop.availableDate ? new Date(prop.availableDate).toISOString().split('T')[0] : '');
    setSelectedAmenities(prop.amenities);
    setPhotos(prop.photos);

    const descParts = prop.description.split('\n\nSecurity Deposit:');
    if (descParts.length > 1) {
      setDescription(descParts[0]);
      const afterDeposit = descParts[1].split('\n\nHouse Rules:');
      setSecurityDeposit(afterDeposit[0].trim().replace('$', ''));
      if (afterDeposit.length > 1) {
        setHouseRules(afterDeposit[1].trim());
      }
    } else {
      const rulesParts = prop.description.split('\n\nHouse Rules:');
      if (rulesParts.length > 1) {
        setDescription(rulesParts[0]);
        setHouseRules(rulesParts[1].trim());
      }
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Required', 'Please enter a valid price');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required', 'Please select a city');
      return;
    }

    if (!isEditing && hostSub) {
      const capResult = canAddListingCheck(hostSub);
      if (!capResult.allowed) {
        setLimitMessage(capResult.message);
        setShowLimitModal(true);
        return;
      }
      if (capResult.message) {
        setOverageMessage(capResult.message);
        setShowOverageModal(true);
        const confirmed = await new Promise<boolean>((resolve) => {
          setOverageResolve(() => resolve);
        });
        setShowOverageModal(false);
        setOverageResolve(null);
        if (!confirmed) return;
      }
    }

    setSaving(true);
    try {
      let fullDescription = description.trim();
      if (securityDeposit.trim()) {
        fullDescription += `\n\nSecurity Deposit: $${securityDeposit.trim()}`;
      }
      if (houseRules.trim()) {
        fullDescription += `\n\nHouse Rules: ${houseRules.trim()}`;
      }

      const supaData = {
        title: title.trim(),
        description: fullDescription,
        rent: Number(price),
        bedrooms,
        bathrooms,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        neighborhood: neighborhood.trim() || undefined,
        room_type: roomType,
        amenities: selectedAmenities,
        photos: photos.length > 0 ? photos : PLACEHOLDER_PHOTOS.slice(0, 1),
        available_date: availableDate && availableDate !== 'flexible' ? new Date(availableDate).toISOString() : undefined,
        is_active: true,
        is_paused: false,
        is_rented: false,
      };

      try {
        if (isEditing && propertyId) {
          await updateListingSupa(propertyId, supaData);
        } else {
          await createListingSupa(supaData);
        }
      } catch {
        const property: Property = {
          id: propertyId || `prop_${Date.now()}`,
          title: title.trim(),
          description: fullDescription,
          price: Number(price),
          bedrooms,
          bathrooms,
          sqft: Number(sqft) || 0,
          propertyType,
          roomType,
          city: city.trim(),
          state: state.trim(),
          neighborhood: neighborhood.trim() || undefined,
          address: address.trim(),
          availableDate: availableDate ? new Date(availableDate) : undefined,
          amenities: selectedAmenities,
          photos: photos.length > 0 ? photos : PLACEHOLDER_PHOTOS.slice(0, 1),
          available: true,
          hostId: user?.id || '',
          hostName: user?.name || '',
          hostProfileId: user?.id,
        };
        await StorageService.addOrUpdateProperty(property);
      }
      if (!isEditing) {
        Alert.alert(
          'Listing Posted!',
          'Your listing is now live. You can manage it from the Listings tab.',
          [
            {
              text: 'View My Listings',
              onPress: () => {
                const parentNav = navigation.getParent();
                if (parentNav) {
                  parentNav.navigate('Listings');
                } else {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Saved', 'Your listing has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!propertyId) return;
    try {
      await deleteListingSupa(propertyId);
    } catch {
    }
    await StorageService.deleteProperty(propertyId);
    navigation.goBack();
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this listing? This cannot be undone.');
      if (confirmed) {
        executeDelete();
      }
      return;
    }
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: executeDelete,
        },
      ]
    );
  };

  const completionFields = [
    title.trim(),
    description.trim(),
    price.trim(),
    city.trim(),
    address.trim(),
    availableDate,
    selectedAmenities.length > 0 ? 'yes' : '',
    photos.length > 0 ? 'yes' : '',
  ];
  const completionCount = completionFields.filter(Boolean).length;
  const completionPct = completionCount / completionFields.length;

  const renderSectionTitle = (sectionName: string) => (
    <View style={styles.sectionTitleRow}>
      <Feather name={(SECTION_ICONS[sectionName] || 'info') as any} size={16} color="#ff6b5b" style={{ marginRight: 8 }} />
      <ThemedText style={styles.sectionTitle}>{sectionName}</ThemedText>
    </View>
  );

  const renderNumberSelector = (
    label: string,
    options: number[],
    value: number,
    onChange: (n: number) => void,
  ) => (
    <View style={styles.fieldContainer}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.chipRow}>
        {options.map(n => {
          const selected = n === value;
          return (
            <Pressable
              key={n}
              style={[
                styles.chip,
                selected ? styles.chipSelected : styles.chipUnselected,
              ]}
              onPress={() => onChange(n)}
            >
              <ThemedText style={[styles.chipText, { color: selected ? '#fff' : '#aaa' }]}>
                {n}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderToggle = (
    label: string,
    optionA: { label: string; value: string },
    optionB: { label: string; value: string },
    currentValue: string,
    onChange: (v: any) => void,
  ) => (
    <View style={styles.fieldContainer}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.toggleRow}>
        {[optionA, optionB].map(opt => {
          const selected = opt.value === currentValue;
          return (
            <Pressable
              key={opt.value}
              style={[
                styles.toggleButton,
                { backgroundColor: selected ? '#ff6b5b' : 'transparent' },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <ThemedText style={[styles.toggleText, { color: selected ? '#fff' : '#666', fontWeight: selected ? '700' : '500' }]}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">{isEditing ? 'Edit Listing' : 'New Listing'}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${completionPct * 100}%` }]} />
        </View>
        <ThemedText style={styles.progressLabel}>
          {Math.round(completionPct * 100)}% complete
        </ThemedText>
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Basic Info')}

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Title</ThemedText>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Sunny 2BR in Williamsburg"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Description</ThemedText>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your listing..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <ThemedText style={styles.charCount}>{description.length} / 500</ThemedText>
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: Spacing.sm }]}>
            <ThemedText style={styles.label}>Price/month</ThemedText>
            <View style={styles.inputWithPrefix}>
              <ThemedText style={styles.inputPrefix}>$</ThemedText>
              <TextInput
                style={styles.inputInner}
                value={price}
                onChangeText={setPrice}
                placeholder="2500"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={[styles.fieldContainer, { flex: 1, marginLeft: Spacing.sm }]}>
            <ThemedText style={styles.label}>Security Deposit</ThemedText>
            <View style={styles.inputWithPrefix}>
              <ThemedText style={styles.inputPrefix}>$</ThemedText>
              <TextInput
                style={styles.inputInner}
                value={securityDeposit}
                onChangeText={setSecurityDeposit}
                placeholder="2500"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {renderNumberSelector('Bedrooms', BEDROOM_OPTIONS, bedrooms, setBedrooms)}
        {renderNumberSelector('Bathrooms', BATHROOM_OPTIONS, bathrooms, setBathrooms)}

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Square Feet</ThemedText>
          <TextInput
            style={styles.input}
            value={sqft}
            onChangeText={setSqft}
            placeholder="800"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Type')}

        {renderToggle(
          'Property Type',
          { label: 'Lease', value: 'lease' },
          { label: 'Sublet', value: 'sublet' },
          propertyType,
          setPropertyType,
        )}

        {renderToggle(
          'Room Type',
          { label: 'Entire Place', value: 'entire' },
          { label: 'Private Room', value: 'room' },
          roomType,
          setRoomType,
        )}
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Location')}

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>City</ThemedText>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Type a city..."
            placeholderTextColor="#666"
          />
          <ThemedText style={[styles.label, { marginTop: 12 }]}>Popular Cities</ThemedText>
          <View style={styles.chipRow}>
            {POPULAR_CITIES.map(c => {
              const selected = c === city;
              return (
                <Pressable
                  key={c}
                  style={[
                    styles.cityChip,
                    selected ? styles.cityChipSelected : styles.cityChipUnselected,
                  ]}
                  onPress={() => setCity(c)}
                >
                  <ThemedText style={[styles.cityChipText, { color: selected ? '#fff' : '#aaa' }]}>
                    {c}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>State</ThemedText>
          <TextInput
            style={styles.input}
            value={state}
            onChangeText={setState}
            placeholder="NY"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Neighborhood</ThemedText>
          <TextInput
            style={styles.input}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="e.g. Williamsburg"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Address</ThemedText>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Available Date</ThemedText>
          <Pressable style={styles.datePickerButton} onPress={() => setShowAvailableDatePicker(true)}>
            <Feather name="calendar" size={18} color="#666" style={{ marginRight: 10 }} />
            <ThemedText style={{ color: availableDate ? '#fff' : '#666', fontSize: 15, flex: 1 }}>
              {availableDate ? formatDate(availableDate) : 'Select available date'}
            </ThemedText>
            <Feather name="chevron-right" size={16} color="#555" />
          </Pressable>
          <DatePickerModal
            visible={showAvailableDatePicker}
            onClose={() => setShowAvailableDatePicker(false)}
            onConfirm={(date) => setAvailableDate(date)}
            mode="availability"
            title="Select Available Date"
            showFlexible
            initialDate={availableDate || undefined}
          />
        </View>
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Amenities')}

        <View style={styles.chipRow}>
          {AMENITIES_LIST.map(amenity => {
            const selected = selectedAmenities.includes(amenity);
            return (
              <Pressable
                key={amenity}
                style={[
                  styles.amenityChip,
                  selected ? styles.amenityChipSelected : styles.amenityChipUnselected,
                ]}
                onPress={() => toggleAmenity(amenity)}
              >
                {selected ? (
                  <Feather name="check" size={14} color="#fff" style={{ marginRight: 4 }} />
                ) : null}
                <ThemedText style={[styles.amenityChipText, { color: selected ? '#fff' : '#aaa' }]}>
                  {amenity}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        {renderSectionTitle('House Rules')}

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.hintText}>e.g. No smoking indoors, quiet hours after 10pm, guests allowed with notice</ThemedText>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={houseRules}
            onChangeText={setHouseRules}
            placeholder="e.g. No smoking, quiet hours after 10pm..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Photos')}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
          {(photos.length > 0 ? photos : PLACEHOLDER_PHOTOS).map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photoThumb} />
            </View>
          ))}
          <Pressable
            style={styles.addPhotoButton}
            onPress={() => {
              const newPhotos = [...photos, PLACEHOLDER_PHOTOS[photos.length % PLACEHOLDER_PHOTOS.length]];
              setPhotos(newPhotos);
            }}
          >
            <Feather name="camera" size={24} color="#555" />
            <ThemedText style={styles.addPhotoText}>Add Photo</ThemedText>
          </Pressable>
        </ScrollView>
        <ThemedText style={styles.photoHint}>Add up to 8 photos. First photo is your cover image.</ThemedText>
      </View>

      <Pressable
        style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Feather name="check" size={20} color="#fff" />
        <ThemedText style={styles.saveButtonText}>
          {saving ? 'Saving...' : isEditing ? 'Update Listing' : 'Create Listing'}
        </ThemedText>
      </Pressable>

      {isEditing ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Feather name="trash-2" size={20} color="#ff4757" />
          <ThemedText style={styles.deleteButtonText}>Delete Listing</ThemedText>
        </Pressable>
      ) : null}

      <View style={{ height: Spacing.xxl }} />

      <ListingLimitModal
        visible={showLimitModal}
        message={limitMessage}
        onCancel={() => setShowLimitModal(false)}
        onUpgrade={() => {
          setShowLimitModal(false);
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Dashboard', { screen: 'HostSubscription' });
          } else {
            navigation.navigate('HostSubscription' as any);
          }
        }}
      />

      <OverageModal
        visible={showOverageModal}
        message={overageMessage}
        onCancel={() => {
          setShowOverageModal(false);
          if (overageResolve) overageResolve(false);
        }}
        onContinue={() => {
          setShowOverageModal(false);
          if (overageResolve) overageResolve(true);
        }}
      />
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1c1c1c',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b5b',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingBottom: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#aaa',
    marginBottom: Spacing.xs,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: '#1c1c1c',
    borderColor: '#333',
    color: '#fff',
  },
  multilineInput: {
    height: 100,
    paddingTop: 14,
    paddingBottom: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
    marginTop: 4,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 16,
    color: '#666',
    marginRight: 6,
  },
  inputInner: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  chipUnselected: {
    backgroundColor: '#1c1c1c',
    borderColor: '#333',
  },
  chipText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  cityChipSelected: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
  },
  cityChipUnselected: {
    backgroundColor: '#1c1c1c',
    borderColor: '#333',
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  amenityChipSelected: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
  },
  amenityChipUnselected: {
    backgroundColor: '#1c1c1c',
    borderColor: '#333',
  },
  amenityChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
    lineHeight: 18,
  },
  photosRow: {
    marginBottom: 8,
  },
  photoContainer: {
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 110,
    height: 110,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#333',
    borderStyle: 'dashed',
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    marginTop: 6,
    color: '#555',
  },
  photoHint: {
    fontSize: 12,
    color: '#555',
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b5b',
    height: 56,
    borderRadius: 14,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    marginTop: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#ff4757',
    backgroundColor: 'transparent',
    gap: Spacing.sm,
  },
  deleteButtonText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '600',
  },
});
