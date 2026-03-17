import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, Image, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { Property, HostSubscriptionData } from '../../types/models';
import { canAddListingCheck } from '../../utils/hostPricing';
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
        Alert.alert('Listing Limit Reached', capResult.message, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Plan',
            onPress: () => {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('Dashboard', { screen: 'HostSubscription' });
              } else {
                navigation.navigate('HostSubscription' as any);
              }
            },
          },
        ]);
        return;
      }
      if (capResult.message) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert('Overage Notice', capResult.message, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ]);
        });
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

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (propertyId) {
              try {
                await deleteListingSupa(propertyId);
              } catch {
                await StorageService.deleteProperty(propertyId);
              }
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: '#1a1a1a', color: theme.text, borderColor: '#333' },
  ];

  const renderSectionTitle = (title: string) => (
    <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
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
                { backgroundColor: selected ? '#ff6b5b' : '#1a1a1a', borderColor: selected ? '#ff6b5b' : '#333' },
              ]}
              onPress={() => onChange(n)}
            >
              <ThemedText style={[styles.chipText, { color: selected ? '#fff' : theme.textSecondary }]}>
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
                { backgroundColor: selected ? '#ff6b5b' : '#1a1a1a', borderColor: selected ? '#ff6b5b' : '#333' },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <ThemedText style={[styles.toggleText, { color: selected ? '#fff' : theme.textSecondary }]}>
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

      {renderSectionTitle('Basic Info')}

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Title</ThemedText>
        <TextInput
          style={inputStyle}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Sunny 2BR in Williamsburg"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Description</ThemedText>
        <TextInput
          style={[...inputStyle, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your listing..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldContainer, { flex: 1, marginRight: Spacing.sm }]}>
          <ThemedText style={styles.label}>Price/month ($)</ThemedText>
          <TextInput
            style={inputStyle}
            value={price}
            onChangeText={setPrice}
            placeholder="2500"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.fieldContainer, { flex: 1, marginLeft: Spacing.sm }]}>
          <ThemedText style={styles.label}>Security Deposit ($)</ThemedText>
          <TextInput
            style={inputStyle}
            value={securityDeposit}
            onChangeText={setSecurityDeposit}
            placeholder="2500"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      </View>

      {renderNumberSelector('Bedrooms', BEDROOM_OPTIONS, bedrooms, setBedrooms)}
      {renderNumberSelector('Bathrooms', BATHROOM_OPTIONS, bathrooms, setBathrooms)}

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Square Feet</ThemedText>
        <TextInput
          style={inputStyle}
          value={sqft}
          onChangeText={setSqft}
          placeholder="800"
          placeholderTextColor="#666"
          keyboardType="numeric"
        />
      </View>

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

      {renderSectionTitle('Location')}

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>City</ThemedText>
        <View style={styles.chipRow}>
          {POPULAR_CITIES.map(c => {
            const selected = c === city;
            return (
              <Pressable
                key={c}
                style={[
                  styles.cityChip,
                  { backgroundColor: selected ? '#ff6b5b' : '#1a1a1a', borderColor: selected ? '#ff6b5b' : '#333' },
                ]}
                onPress={() => setCity(c)}
              >
                <ThemedText style={[styles.chipText, { color: selected ? '#fff' : theme.textSecondary }]}>
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
          style={inputStyle}
          value={state}
          onChangeText={setState}
          placeholder="NY"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Neighborhood</ThemedText>
        <TextInput
          style={inputStyle}
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="e.g. Williamsburg"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Address</ThemedText>
        <TextInput
          style={inputStyle}
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main St"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText style={styles.label}>Available Date</ThemedText>
        <Pressable
          style={inputStyle}
          onPress={() => setShowAvailableDatePicker(true)}
        >
          <ThemedText style={{ color: availableDate ? '#fff' : '#666' }}>
            {availableDate ? formatDate(availableDate) : 'Select available date'}
          </ThemedText>
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

      {renderSectionTitle('Amenities')}

      <View style={styles.chipRow}>
        {AMENITIES_LIST.map(amenity => {
          const selected = selectedAmenities.includes(amenity);
          return (
            <Pressable
              key={amenity}
              style={[
                styles.amenityChip,
                { backgroundColor: selected ? '#ff6b5b' : '#1a1a1a', borderColor: selected ? '#ff6b5b' : '#333' },
              ]}
              onPress={() => toggleAmenity(amenity)}
            >
              {selected ? (
                <Feather name="check" size={14} color="#fff" style={{ marginRight: 4 }} />
              ) : null}
              <ThemedText style={[styles.chipText, { color: selected ? '#fff' : theme.textSecondary }]}>
                {amenity}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {renderSectionTitle('House Rules')}

      <View style={styles.fieldContainer}>
        <TextInput
          style={[...inputStyle, styles.multilineInput]}
          value={houseRules}
          onChangeText={setHouseRules}
          placeholder="e.g. No smoking, quiet hours after 10pm..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {renderSectionTitle('Photos')}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
        {(photos.length > 0 ? photos : PLACEHOLDER_PHOTOS).map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photoThumb} />
          </View>
        ))}
        <Pressable
          style={[styles.addPhotoButton, { borderColor: '#333' }]}
          onPress={() => {
            const newPhotos = [...photos, PLACEHOLDER_PHOTOS[photos.length % PLACEHOLDER_PHOTOS.length]];
            setPhotos(newPhotos);
          }}
        >
          <Feather name="plus" size={24} color={theme.textSecondary} />
          <ThemedText style={[styles.addPhotoText, { color: theme.textSecondary }]}>Add</ThemedText>
        </Pressable>
      </ScrollView>

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
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff6b5b',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
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
    width: 44,
    height: 44,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photosRow: {
    marginBottom: Spacing.lg,
  },
  photoContainer: {
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.medium,
    overflow: 'hidden',
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.medium,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b5b',
    height: 52,
    borderRadius: BorderRadius.medium,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.medium,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#ff4757',
    gap: Spacing.sm,
  },
  deleteButtonText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '600',
  },
});
