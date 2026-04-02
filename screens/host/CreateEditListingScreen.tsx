import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { SinglePricePicker, RENT_OPTIONS, DEPOSIT_OPTIONS, formatPriceDisplay, normalizeToOption } from '../../components/PricePicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { Property, HostSubscriptionData } from '../../types/models';
import { ListingLimitModal, OverageModal } from '../../components/ListingLimitModal';
import { US_STATES } from '../../utils/locationData';
import { Spacing, BorderRadius } from '../../constants/theme';
import { createListing as createListingSupa, updateListing as updateListingSupa, getListing, deleteListing as deleteListingSupa, mapListingToProperty, getCompanyAgents } from '../../services/listingService';
import { DatePickerModal } from '../../components/DatePickerModal';
import { formatDate } from '../../utils/dateUtils';
import { geocodeAddress, fetchNearbyTransit } from '../../utils/transitService';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as ImagePicker from 'expo-image-picker';

type RouteParams = {
  CreateEditListing: { propertyId?: string };
};

import {
  getHostAmenities,
  AMENITY_CATEGORIES,
  AmenityCategory,
  normalizeLegacyAmenity,
} from '../../constants/amenities';

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const BATHROOM_OPTIONS = [1, 2, 3, 4];

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
  const { user, getHostPlan, canAddListing } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();

  const propertyId = route.params?.propertyId;
  const isEditing = !!propertyId;
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [existingIsPaused, setExistingIsPaused] = useState(false);
  const [existingIsRented, setExistingIsRented] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(2000);
  const [securityDeposit, setSecurityDeposit] = useState(0);
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [sqft, setSqft] = useState('');
  const [propertyType, setPropertyType] = useState<'lease' | 'sublet'>('lease');
  const [roomType, setRoomType] = useState<'room' | 'entire'>('entire');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [showAvailableDatePicker, setShowAvailableDatePicker] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [expandedHostCategories, setExpandedHostCategories] = useState<Set<AmenityCategory>>(new Set(['unit_features']));
  const [houseRules, setHouseRules] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [transitOverride, setTransitOverride] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [addressFromAutocomplete, setAddressFromAutocomplete] = useState(false);

  const handleManualAddressChange = useCallback((text: string) => {
    setAddress(text);
    if (addressFromAutocomplete) {
      setCoordinates(null);
      setAddressFromAutocomplete(false);
    }
  }, [addressFromAutocomplete]);
  const [hostLivesIn, setHostLivesIn] = useState(false);
  const [existingRoommatesCount, setExistingRoommatesCount] = useState(0);
  const [requiresBackgroundCheck, setRequiresBackgroundCheck] = useState(false);
  const [preferredTenantGender, setPreferredTenantGender] = useState<'any' | 'female_only' | 'male_only'>('any');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignedAgentId, setAssignedAgentId] = useState<string>('');
  const [companyAgents, setCompanyAgents] = useState<{ id: string; full_name: string }[]>([]);
  const isCompanyHost = user?.hostType === 'company';
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
      if (user.hostType === 'company') {
        getCompanyAgents(user.id).then(agents => setCompanyAgents(agents));
      }
    }
  }, [propertyId, user]);

  const loadProperty = async () => {
    if (!propertyId) return;
    let prop: any = null;
    try {
      const supaListing = await getListing(propertyId);
      if (supaListing) {
        prop = mapListingToProperty(supaListing, user?.name);
      }
    } catch {
      const properties = await StorageService.getProperties();
      const found = properties.find(p => p.id === propertyId);
      if (found) {
        prop = found;
      }
    }
    if (!prop) return;

    if (prop.is_paused || prop.isPaused) setExistingIsPaused(true);
    if (prop.is_rented || prop.isRented || prop.rentedDate) setExistingIsRented(true);

    setTitle(prop.title);
    setDescription(prop.description);
    setPrice(normalizeToOption(prop.price || 2000, RENT_OPTIONS));
    setBedrooms(prop.bedrooms);
    setBathrooms(prop.bathrooms);
    setSqft(prop.sqft.toString());
    setPropertyType(prop.propertyType);
    setRoomType(prop.roomType);
    setCity(prop.city);
    setState(prop.state);
    setNeighborhood(prop.neighborhood || '');
    setZipCode((prop as any).zip_code || '');
    setAddress(prop.address);
    setAvailableDate(prop.availableDate ? new Date(prop.availableDate).toISOString().split('T')[0] : '');
    setSelectedAmenities(
      (Array.isArray(prop.amenities) ? prop.amenities : [])
        .map((a: string) => normalizeLegacyAmenity(a))
        .filter(Boolean)
    );
    setPhotos(prop.photos);
    if (prop.hostLivesIn !== undefined) setHostLivesIn(!!prop.hostLivesIn);
    if (prop.existing_roommates_count !== undefined) setExistingRoommatesCount(prop.existing_roommates_count);
    if (prop.host_lives_in !== undefined) setHostLivesIn(!!prop.host_lives_in);
    if (prop.existingRoommatesCount !== undefined) setExistingRoommatesCount(prop.existingRoommatesCount);
    if (prop.requires_background_check !== undefined) setRequiresBackgroundCheck(!!prop.requires_background_check);
    if (prop.preferred_tenant_gender) setPreferredTenantGender(prop.preferred_tenant_gender);
    if (prop.transitInfo?.manualOverride) {
      setTransitOverride(prop.transitInfo.manualOverride);
    }
    if (prop.coordinates) {
      setCoordinates(prop.coordinates);
    }
    if (prop.assigned_agent_id) {
      setAssignedAgentId(prop.assigned_agent_id);
    }

    const descParts = prop.description.split('\n\nSecurity Deposit:');
    if (descParts.length > 1) {
      setDescription(descParts[0]);
      const afterDeposit = descParts[1].split('\n\nHouse Rules:');
      const depVal = parseInt(afterDeposit[0].trim().replace('$', '').replace(/,/g, ''));
      setSecurityDeposit(isNaN(depVal) ? 0 : normalizeToOption(depVal, DEPOSIT_OPTIONS));
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

  const handleAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await showAlert({ title: 'Permission Required', message: 'Please allow access to your photo library to upload listing photos.', variant: 'warning' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);

    try {
      const { uploadListingPhoto } = await import('../../services/listingService');
      const uploadedUrl = await uploadListingPhoto(asset.uri, asset.fileName || `photo_${Date.now()}.jpg`);
      setPhotos(prev => [...prev, uploadedUrl]);
    } catch (err) {
      console.warn('Photo upload failed, using local URI:', err);
      setPhotos(prev => [...prev, asset.uri]);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      await showAlert({ title: 'Required', message: 'Please enter a title', variant: 'warning' });
      return;
    }
    if (!price || price <= 0) {
      await showAlert({ title: 'Required', message: 'Please enter a valid price', variant: 'warning' });
      return;
    }
    if (!city.trim()) {
      await showAlert({ title: 'Required', message: 'Please select a city', variant: 'warning' });
      return;
    }
    if (isCompanyHost && !assignedAgentId) {
      await showAlert({ title: 'Agent Required', message: 'Please assign an agent to this listing before publishing.', variant: 'warning' });
      return;
    }

    const roomsAvailableCheck = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
    if (roomsAvailableCheck < 1) {
      await showAlert({ title: 'Invalid Configuration', message: 'Your listing must have at least 1 room available for renters. Adjust bedrooms or existing roommates.', variant: 'warning' });
      return;
    }

    if (!isEditing) {
      if (!hostSub) {
        await showAlert({ title: 'Unable to verify plan', message: 'Please try again in a moment.', variant: 'warning' });
        return;
      }
      const capResult = canAddListing(hostSub.activeListingCount || 0);
      if (!capResult.allowed) {
        setLimitMessage(capResult.reason || 'You have reached your listing limit.');
        setShowLimitModal(true);
        return;
      }
    }

    setSaving(true);
    try {
      let fullDescription = description.trim();
      if (securityDeposit > 0) {
        fullDescription += `\n\nSecurity Deposit: $${securityDeposit.toLocaleString()}`;
      }
      if (houseRules.trim()) {
        fullDescription += `\n\nHouse Rules: ${houseRules.trim()}`;
      }

      let transitInfo: any = undefined;
      let savedCoords: any = undefined;
      try {
        const override = transitOverride.trim() || undefined;
        let coords = coordinates;
        if (!coords) {
          coords = await geocodeAddress(address.trim(), city.trim(), state.trim());
        }
        if (coords) {
          savedCoords = coords;
          const stops = await fetchNearbyTransit(coords.lat, coords.lng);
          transitInfo = {
            stops,
            noTransitNearby: stops.length === 0,
            manualOverride: override,
            fetchedAt: new Date().toISOString(),
          };
        } else {
          transitInfo = {
            stops: [],
            noTransitNearby: true,
            manualOverride: override,
            fetchedAt: new Date().toISOString(),
          };
        }
      } catch (transitError) {
        console.warn('Transit fetch failed:', transitError);
      }

      const today = new Date().toISOString().split('T')[0];
      const resolvedAvailableDate = availableDate && availableDate !== 'flexible'
        ? new Date(availableDate).toISOString()
        : new Date(today).toISOString();

      const supaData: any = {
        title: title.trim(),
        description: fullDescription,
        rent: price,
        bedrooms,
        bathrooms,
        host_lives_in: hostLivesIn,
        existing_roommates_count: existingRoommatesCount,
        requires_background_check: requiresBackgroundCheck,
        sqft: Number(sqft) || 0,
        property_type: propertyType,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        neighborhood: neighborhood.trim() || undefined,
        zip_code: zipCode.trim() || undefined,
        room_type: roomType,
        listing_type: roomType === 'entire' ? 'entire_apartment' : 'room',
        preferred_tenant_gender: roomType === 'room' && !isCompanyHost && user?.hostType !== 'agent' ? preferredTenantGender : 'any',
        amenities: selectedAmenities,
        photos: photos,
        available_date: resolvedAvailableDate,
        is_active: isEditing ? !(existingIsPaused || existingIsRented) : true,
        is_paused: isEditing ? existingIsPaused : false,
        is_rented: isEditing ? existingIsRented : false,
        host_name: user?.name || '',
        host_profile_id: user?.id || '',
      };
      if (savedCoords) supaData.coordinates = savedCoords;
      if (transitInfo) supaData.transit_info = transitInfo;
      if (isCompanyHost && assignedAgentId) supaData.assigned_agent_id = assignedAgentId;

      let createdListingId: string | null = null;
      try {
        if (isEditing && propertyId) {
          await updateListingSupa(propertyId, supaData);
        } else {
          const created = await createListingSupa(supaData);
          createdListingId = created?.id || null;
        }
      } catch {
        const property: Property = {
          id: propertyId || `prop_${Date.now()}`,
          title: title.trim(),
          description: fullDescription,
          price: price,
          bedrooms,
          bathrooms,
          sqft: Number(sqft) || 0,
          propertyType,
          roomType,
          city: city.trim(),
          state: state.trim(),
          neighborhood: neighborhood.trim() || undefined,
          zip_code: zipCode.trim() || undefined,
          address: address.trim(),
          availableDate: new Date(resolvedAvailableDate),
          amenities: selectedAmenities,
          photos: photos,
          available: !availableDate || new Date(availableDate).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0),
          hostId: user?.id || '',
          hostName: user?.name || '',
          hostProfileId: user?.id,
          coordinates: savedCoords,
          transitInfo,
        };
        await StorageService.addOrUpdateProperty(property);
      }
      if (!isEditing) {
        if (existingRoommatesCount > 0 && createdListingId) {
          await showAlert({ title: 'Listing Posted!', message: 'Now let\'s set up profile links for your existing roommates.', variant: 'success' });
          navigation.navigate('InviteExistingRoommates' as any, {
            listingId: createdListingId,
            count: existingRoommatesCount,
            listingAddress: address.trim(),
          });
        } else {
          await showAlert({ title: 'Listing Posted!', message: 'Your listing is now live. You can manage it from the Listings tab.', variant: 'success' });
          const parentNav = navigation.getParent();
          if (parentNav) {
            parentNav.navigate('Listings');
          } else {
            navigation.goBack();
          }
        }
      } else {
        if (propertyId) {
          await StorageService.notifyPropertyEvent(
            propertyId,
            'property_update',
            'Listing Updated',
            `${title.trim()} has been updated with new details`,
          );
        }
        await showAlert({ title: 'Saved', message: 'Your listing has been updated.', variant: 'success' });
        navigation.goBack();
      }
    } catch (error) {
      await showAlert({ title: 'Error', message: 'Failed to save listing', variant: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!propertyId) return;
    await StorageService.notifyPropertyEvent(
      propertyId,
      'property_update',
      'Listing Removed',
      `${title.trim() || 'A listing'} is no longer available`,
    );
    try {
      await deleteListingSupa(propertyId);
    } catch {
    }
    await StorageService.deleteProperty(propertyId);
    navigation.goBack();
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Listing',
      message: 'Are you sure you want to delete this listing? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      executeDelete();
    }
  };

  const completionFields = [
    title.trim(),
    description.trim(),
    price > 0 ? String(price) : '',
    city.trim(),
    address.trim(),
    availableDate,
    selectedAmenities.length > 0 ? 'yes' : '',
    photos.length > 0 ? 'yes' : '',
  ];
  const completionCount = completionFields.filter(Boolean).length;
  const completionPct = completionCount / completionFields.length;

  const renderSectionTitle = (sectionName: string, subtitle?: string) => (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIconWrap}>
        <Feather name={(SECTION_ICONS[sectionName] || 'info') as any} size={15} color="#ff6b5b" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{sectionName}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  const renderNumberSelector = (
    label: string,
    options: number[],
    value: number,
    onChange: (n: number) => void,
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map(n => {
          const selected = n === value;
          return (
            <Pressable
              key={n}
              style={[
                styles.chip,
                selected ? styles.chipSelected : styles.chipUnselected,
                { width: 44, height: 44 },
              ]}
              onPress={() => onChange(n)}
            >
              <Text style={[styles.chipText, { color: selected ? '#fff' : 'rgba(255,255,255,0.45)' }]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderToggle = (
    label: string,
    optionA: { label: string; value: string; icon: string },
    optionB: { label: string; value: string; icon: string },
    currentValue: string,
    onChange: (v: any) => void,
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
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
              <Feather
                name={opt.icon as any}
                size={14}
                color={selected ? '#fff' : 'rgba(255,255,255,0.35)'}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.toggleText, { color: selected ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: selected ? '700' : '500' }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScreenKeyboardAwareScrollView style={{ backgroundColor: '#0d0d0d' }}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Listing' : 'New Listing'}
          </Text>
          {!isEditing ? (
            <Text style={styles.headerSubtitle}>Fill in your listing details</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={[styles.progressLabel, { color: '#ff6b5b', fontWeight: '600' }]}>
            {Math.round(completionPct * 100)}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${completionPct * 100}%` }]} />
        </View>
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
            <ThemedText style={styles.priceDisplay}>{formatPriceDisplay(price)}</ThemedText>
            <SinglePricePicker
              value={price}
              onChange={setPrice}
              options={RENT_OPTIONS}
              height={130}
            />
          </View>
          <View style={[styles.fieldContainer, { flex: 1, marginLeft: Spacing.sm }]}>
            <ThemedText style={styles.label}>Security Deposit</ThemedText>
            <ThemedText style={styles.priceDisplay}>{securityDeposit === 0 ? 'None' : formatPriceDisplay(securityDeposit)}</ThemedText>
            <SinglePricePicker
              value={securityDeposit}
              onChange={setSecurityDeposit}
              options={DEPOSIT_OPTIONS}
              height={130}
            />
          </View>
        </View>

        {renderNumberSelector('Bedrooms', BEDROOM_OPTIONS, bedrooms, (n) => {
          setBedrooms(n);
          const maxExisting = n - (hostLivesIn ? 1 : 0) - 1;
          if (existingRoommatesCount > maxExisting) setExistingRoommatesCount(Math.max(0, maxExisting));
        })}
        {renderNumberSelector('Bathrooms', BATHROOM_OPTIONS, bathrooms, setBathrooms)}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Do you live in this unit?</Text>
          <View style={styles.toggleRow}>
            {[{ label: 'Yes', value: true, icon: 'check' }, { label: 'No', value: false, icon: 'x' }].map(opt => {
              const selected = opt.value === hostLivesIn;
              return (
                <Pressable
                  key={String(opt.value)}
                  style={[styles.toggleButton, { backgroundColor: selected ? '#ff6b5b' : 'transparent' }]}
                  onPress={() => {
                    setHostLivesIn(opt.value);
                    const maxExisting = bedrooms - (opt.value ? 1 : 0) - 1;
                    if (existingRoommatesCount > maxExisting) setExistingRoommatesCount(Math.max(0, maxExisting));
                  }}
                >
                  <Feather name={opt.icon as any} size={14} color={selected ? '#fff' : 'rgba(255,255,255,0.35)'} />
                  <Text style={[styles.toggleText, { color: selected ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: selected ? '700' : '500', marginLeft: 5 }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Existing Roommates</Text>
          <Text style={styles.sectionSubtitle}>
            How many people already live here (not counting yourself)?
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 }}>
            <Pressable
              style={[styles.chip, styles.chipUnselected, { width: 44, height: 44 }]}
              onPress={() => setExistingRoommatesCount(Math.max(0, existingRoommatesCount - 1))}
            >
              <Text style={[styles.chipText, { color: 'rgba(255,255,255,0.45)' }]}>-</Text>
            </Pressable>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', minWidth: 30, textAlign: 'center' }}>
              {existingRoommatesCount}
            </Text>
            <Pressable
              style={[styles.chip, styles.chipUnselected, { width: 44, height: 44 }]}
              onPress={() => {
                const maxExisting = bedrooms - (hostLivesIn ? 1 : 0) - 1;
                setExistingRoommatesCount(Math.min(maxExisting, existingRoommatesCount + 1));
              }}
            >
              <Text style={[styles.chipText, { color: 'rgba(255,255,255,0.45)' }]}>+</Text>
            </Pressable>
          </View>
        </View>

        {(() => {
          const roomsAvailable = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,107,91,0.08)', padding: 10, borderRadius: 8, marginTop: 4 }}>
              <Feather name="key" size={16} color="#ff6b5b" />
              <Text style={{ fontSize: 13, color: '#ff6b5b', fontWeight: '600' }}>
                {roomsAvailable} room{roomsAvailable !== 1 ? 's' : ''} available to fill
              </Text>
            </View>
          );
        })()}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Require Background Check</Text>
          <Text style={[styles.sectionSubtitle, { marginBottom: 8 }]}>
            Only renters with a verified background check can apply
          </Text>
          <View style={styles.toggleRow}>
            {[{ label: 'Yes', value: true, icon: 'shield' }, { label: 'No', value: false, icon: 'x' }].map(opt => {
              const selected = opt.value === requiresBackgroundCheck;
              return (
                <Pressable
                  key={String(opt.value)}
                  style={[styles.toggleButton, { backgroundColor: selected ? '#22c55e' : 'transparent' }]}
                  onPress={() => setRequiresBackgroundCheck(opt.value)}
                >
                  <Feather name={opt.icon as any} size={14} color={selected ? '#fff' : 'rgba(255,255,255,0.35)'} />
                  <Text style={[styles.toggleText, { color: selected ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: selected ? '700' : '500', marginLeft: 5 }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

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

        {isCompanyHost ? (
          <View style={styles.fieldContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.label}>Assign Agent</Text>
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Required</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { marginBottom: 8 }]}>
              Select an agent from your team to manage this listing
            </Text>
            {companyAgents.length === 0 ? (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
                <Text style={{ color: '#F59E0B', fontSize: 13 }}>
                  No team members found. Add agents in Team Management first.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {companyAgents.map(agent => {
                  const selected = assignedAgentId === agent.id;
                  return (
                    <Pressable
                      key={agent.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        padding: 12, borderRadius: 10,
                        backgroundColor: selected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                        borderWidth: 1, borderColor: selected ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)',
                      }}
                      onPress={() => setAssignedAgentId(selected ? '' : agent.id)}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: selected ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Feather name={selected ? 'check' : 'user'} size={14} color={selected ? '#fff' : 'rgba(255,255,255,0.5)'} />
                      </View>
                      <Text style={{ color: selected ? '#3b82f6' : 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: selected ? '600' : '400', flex: 1 }}>
                        {agent.full_name}
                      </Text>
                      {selected ? <Feather name="check-circle" size={16} color="#3b82f6" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Type')}

        {renderToggle(
          'Property Type',
          { label: 'Lease', value: 'lease', icon: 'file-text' },
          { label: 'Sublet', value: 'sublet', icon: 'clock' },
          propertyType,
          setPropertyType,
        )}

        {renderToggle(
          'Room Type',
          { label: 'Entire Place', value: 'entire', icon: 'home' },
          { label: 'Private Room', value: 'room', icon: 'user' },
          roomType,
          (val: 'room' | 'entire') => {
            setRoomType(val);
            if (val === 'entire') setPreferredTenantGender('any');
          },
        )}

        {roomType === 'room' && !isCompanyHost && user?.hostType !== 'agent' ? (
          <View style={{ marginTop: 16 }}>
            <ThemedText style={styles.label}>Tenant Gender Preference</ThemedText>
            <ThemedText style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 }}>
              Shared living spaces can specify a preference
            </ThemedText>
            {([
              { key: 'any', label: 'Any gender', sub: 'Open to everyone', icon: 'users' },
              { key: 'female_only', label: 'Women only', sub: 'Female tenants only', icon: 'user' },
              { key: 'male_only', label: 'Men only', sub: 'Male tenants only', icon: 'user' },
            ] as const).map(opt => {
              const sel = preferredTenantGender === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setPreferredTenantGender(opt.key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 10, marginBottom: 8,
                    backgroundColor: sel ? 'rgba(255,107,91,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: sel ? '#ff6b5b' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Feather name={opt.icon as any} size={18} color={sel ? '#ff6b5b' : 'rgba(255,255,255,0.4)'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: sel ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: sel ? '600' : '400' }}>
                      {opt.label}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                      {opt.sub}
                    </Text>
                  </View>
                  {sel ? <Feather name="check-circle" size={18} color="#ff6b5b" /> : null}
                </Pressable>
              );
            })}
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4, lineHeight: 15 }}>
              Gender preferences are permitted for shared living spaces under the Fair Housing Act's roommate exemption.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        {renderSectionTitle('Location', 'Used to match nearby renters')}

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
          <ThemedText style={styles.label}>Zip Code</ThemedText>
          <TextInput
            style={styles.input}
            value={zipCode}
            onChangeText={(t) => setZipCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
            placeholder="10001"
            placeholderTextColor="#666"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>

        <View style={[styles.fieldContainer, { zIndex: 1000 }]}>
          <ThemedText style={styles.label}>Address</ThemedText>
          {process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? (
            <GooglePlacesAutocomplete
              placeholder="Start typing your address..."
              fetchDetails={true}
              onPress={(data: any, details: any = null) => {
                if (!details) return;
                const components = details.address_components;
                const getComponent = (type: string) =>
                  components.find((c: any) => c.types.includes(type));
                const streetNumber = getComponent('street_number')?.long_name || '';
                const streetName = getComponent('route')?.long_name || '';
                const cityName =
                  getComponent('locality')?.long_name ||
                  getComponent('sublocality')?.long_name ||
                  getComponent('administrative_area_level_2')?.long_name || '';
                const stateName =
                  getComponent('administrative_area_level_1')?.short_name || '';
                const neighborhoodName =
                  getComponent('neighborhood')?.long_name ||
                  getComponent('sublocality_level_1')?.long_name || '';
                setAddress(`${streetNumber} ${streetName}`.trim());
                setCity(cityName);
                setState(stateName);
                if (neighborhoodName) setNeighborhood(neighborhoodName);
                const loc = details.geometry.location;
                setCoordinates({ lat: loc.lat, lng: loc.lng });
                setAddressFromAutocomplete(true);
              }}
              query={{
                key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                language: 'en',
                types: 'address',
              }}
              textInputProps={{
                value: address,
                onChangeText: handleManualAddressChange,
                placeholderTextColor: '#666',
              }}
              styles={{
                container: { flex: 0 },
                textInput: {
                  height: 50,
                  backgroundColor: '#141414',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  fontSize: 15,
                  color: '#fff',
                },
                listView: {
                  backgroundColor: '#1a1a1a',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  marginTop: 4,
                  zIndex: 1000,
                },
                row: {
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: '#1a1a1a',
                },
                description: {
                  fontSize: 14,
                  color: '#ccc',
                },
                separator: {
                  height: 1,
                  backgroundColor: '#333',
                },
              }}
              enablePoweredByContainer={false}
              minLength={3}
              debounce={300}
              keyboardShouldPersistTaps="handled"
              onFail={(error: any) => console.warn('Places autocomplete error:', error)}
              onNotFound={() => {}}
            />
          ) : (
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={handleManualAddressChange}
              placeholder="Enter your address"
              placeholderTextColor="#666"
            />
          )}
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText style={styles.label}>Transportation (optional)</ThemedText>
          <ThemedText style={styles.labelHint}>
            We auto-detect nearby transit from your address. Override below if needed.
          </ThemedText>
          <TextInput
            style={[styles.input, styles.multilineInput, { minHeight: 60 }]}
            placeholder="e.g. Near Metro Line 2, Bus Route 40, 5 min walk to station"
            placeholderTextColor="#666"
            value={transitOverride}
            onChangeText={setTransitOverride}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
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

        {AMENITY_CATEGORIES.map(category => {
          const categoryAmenities = getHostAmenities().filter(a => a.category === category.key);
          if (categoryAmenities.length === 0) return null;
          const selectedCount = categoryAmenities.filter(a => selectedAmenities.includes(a.id)).length;
          const isExpanded = expandedHostCategories.has(category.key);

          return (
            <View key={category.key} style={{ marginBottom: 8 }}>
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                }}
                onPress={() => {
                  setExpandedHostCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(category.key)) next.delete(category.key);
                    else next.add(category.key);
                    return next;
                  });
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name={category.icon} size={16} color="#888" />
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>
                    {category.label}
                  </ThemedText>
                  {selectedCount > 0 ? (
                    <View style={{
                      backgroundColor: '#ff6b5b',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{selectedCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#888" />
              </Pressable>

              {isExpanded ? (
                <View style={styles.chipRow}>
                  {categoryAmenities.map(amenity => {
                    const selected = selectedAmenities.includes(amenity.id);
                    return (
                      <Pressable
                        key={amenity.id}
                        style={[
                          styles.amenityChip,
                          selected ? styles.amenityChipSelected : styles.amenityChipUnselected,
                        ]}
                        onPress={() => toggleAmenity(amenity.id)}
                      >
                        <Feather
                          name={amenity.icon}
                          size={14}
                          color={selected ? '#fff' : '#888'}
                          style={{ marginRight: 4 }}
                        />
                        <ThemedText style={[styles.amenityChipText, { color: selected ? '#fff' : '#aaa' }]}>
                          {amenity.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        {renderSectionTitle('House Rules', 'Optional — helps set renter expectations')}

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
        {renderSectionTitle('Photos', 'First photo becomes your cover image')}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photoThumb} />
              <Pressable
                style={styles.removePhotoBtn}
                onPress={() => handleRemovePhoto(index)}
              >
                <Feather name="x" size={14} color="#fff" />
              </Pressable>
              {index === 0 ? (
                <View style={styles.coverBadge}>
                  <ThemedText style={styles.coverBadgeText}>Cover</ThemedText>
                </View>
              ) : null}
            </View>
          ))}
          {photos.length < 8 ? (
            <Pressable
              style={[styles.addPhotoButton, { opacity: uploadingPhoto ? 0.6 : 1 }]}
              onPress={handleAddPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Feather name="camera" size={24} color="#555" />
                  <ThemedText style={styles.addPhotoText}>Add Photo</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
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
          <Feather name="trash-2" size={14} color="rgba(255,255,255,0.25)" />
          <Text style={styles.deleteButtonText}>Delete listing</Text>
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
    marginBottom: 18,
    paddingTop: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b5b',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 14,
    marginBottom: 18,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.1,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 7,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.1)',
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
  priceDisplay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 4,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  chipUnselected: {
    backgroundColor: '#1e1e1e',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    fontSize: 15,
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
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.12)',
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
    borderWidth: 1,
    marginBottom: 4,
  },
  amenityChipSelected: {
    backgroundColor: '#ff6b5b',
    borderColor: '#ff6b5b',
  },
  amenityChipUnselected: {
    backgroundColor: '#1e1e1e',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  amenityChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  labelHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    marginTop: -4,
  },
  photosRow: {
    marginBottom: 8,
  },
  photoContainer: {
    marginRight: 10,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  removePhotoBtn: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  coverBadge: {
    position: 'absolute' as const,
    bottom: 7,
    left: 7,
    backgroundColor: 'rgba(255,107,91,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  photoThumb: {
    width: 120,
    height: 120,
    borderRadius: 14,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed' as const,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addPhotoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
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
    borderRadius: 16,
    marginTop: 24,
    gap: 8,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteButtonText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    fontWeight: '500',
  },
});
