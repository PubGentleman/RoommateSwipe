import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Image, ScrollView, FlatList, ActivityIndicator, Animated, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { SinglePricePicker, RENT_OPTIONS, DEPOSIT_OPTIONS, formatPriceDisplay, normalizeToOption } from '../../components/PricePicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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
import { geocodeAddress } from '../../utils/transitService';
import { fetchAreaInfo } from '../../services/neighborhoodService';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RouteParams = {
  CreateEditListing: { propertyId?: string };
};

import {
  getHostAmenities,
  AMENITY_CATEGORIES,
  AmenityCategory,
  normalizeLegacyAmenity,
} from '../../constants/amenities';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const BATHROOM_OPTIONS = [1, 2, 3, 4];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_WIDTH = SCREEN_WIDTH - 40;
const PHOTO_COL_WIDTH = (PHOTO_GRID_WIDTH - 10) / 2;

export const CreateEditListingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CreateEditListing'>>();
  const { theme } = useTheme();
  const { user, getHostPlan, canAddListing } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

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
  const [expandedHostCategories, setExpandedHostCategories] = useState<Set<AmenityCategory>>(
    new Set(AMENITY_CATEGORIES.map(c => c.key))
  );
  const [houseRules, setHouseRules] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [transitOverride, setTransitOverride] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const addressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [transitLoading, setTransitLoading] = useState(false);

  const fetchTransitForLocation = useCallback(async (lat: number, lng: number) => {
    setTransitLoading(true);
    try {
      console.log('Fetching transit for:', lat, lng);
      const areaInfo = await fetchAreaInfo(lat, lng);
      console.log('Transit results:', areaInfo?.transit?.length ?? 0, 'stops found');
      if (areaInfo && areaInfo.transit && areaInfo.transit.length > 0) {
        const summary = areaInfo.transit
          .slice(0, 6)
          .map(stop => {
            const walkMin = Math.max(1, Math.round((stop.distanceMi || 0) * 20));
            return `${stop.type}: ${stop.name} (${walkMin} min walk)`;
          })
          .join('\n');
        if (!transitOverride.trim()) {
          setTransitOverride(summary);
        }
      } else {
        if (!transitOverride.trim()) {
          setTransitOverride('No major transit stations found nearby');
        }
      }
    } catch (err) {
      console.warn('Transit auto-detect failed:', err);
    } finally {
      setTransitLoading(false);
    }
  }, [transitOverride]);

  const searchAddress = useCallback(async (text: string) => {
    if (text.length < 3) { setAddressResults([]); return; }
    setAddressLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?q=${encodeURIComponent(text)}&countrycodes=us&format=json&addressdetails=1&limit=5&zoom=18`,
        { headers: { 'User-Agent': 'RhomeApp/1.0' } }
      );
      if (res.ok) setAddressResults(await res.json());
    } catch { setAddressResults([]); }
    finally { setAddressLoading(false); }
  }, []);

  const handleAddressTextChange = useCallback((text: string) => {
    setAddress(text);
    setCoordinates(null);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(() => searchAddress(text), 350);
  }, [searchAddress]);

  const handleAddressSelect = useCallback((result: any) => {
    const addr = result.address || {};
    const displayParts = (result.display_name || '').split(',').map((s: string) => s.trim());
    console.log('Nominatim result:', JSON.stringify(result.address, null, 2));
    console.log('Display name:', result.display_name);

    const houseNumber = addr.house_number || '';
    const road = addr.road || '';
    const streetAddress = `${houseNumber} ${road}`.trim() || displayParts[0] || '';

    let cityName = '';
    if (addr.borough && addr.borough !== addr.city) {
      cityName = addr.borough;
    } else if (addr.suburb && addr.city && addr.suburb !== addr.city) {
      cityName = addr.suburb;
    } else if (addr.city) {
      cityName = addr.city;
    } else if (addr.town) {
      cityName = addr.town;
    } else if (addr.village) {
      cityName = addr.village;
    } else {
      cityName = displayParts[2] || displayParts[1] || '';
    }

    let neighborhoodName = '';
    if (addr.quarter) {
      neighborhoodName = addr.quarter;
    } else if (addr.neighbourhood) {
      neighborhoodName = addr.neighbourhood;
    } else if (addr.suburb && addr.suburb !== cityName) {
      neighborhoodName = addr.suburb;
    } else {
      const candidate = displayParts[1] || '';
      if (candidate && candidate !== cityName && !candidate.includes('County')) {
        neighborhoodName = candidate;
      }
    }

    const stateName = addr.state || '';
    let zip = addr.postcode || '';
    if (!zip) {
      const zipPart = displayParts.find((p: string) => /^\d{5}$/.test(p));
      if (zipPart) zip = zipPart;
    }

    if (streetAddress) setAddress(streetAddress);
    if (cityName) setCity(cityName);
    if (stateName) setState(stateName);
    if (neighborhoodName) setNeighborhood(neighborhoodName);
    if (zip) setZipCode(zip);

    if (result.lat && result.lon) {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      setCoordinates({ lat, lng });
      fetchTransitForLocation(lat, lng);
    }

    setAddressResults([]);
  }, [fetchTransitForLocation]);

  const searchCity = useCallback(async (text: string) => {
    if (text.length < 2) { setCityResults([]); return; }
    setCityLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?city=${encodeURIComponent(text)}&countrycodes=us&format=json&addressdetails=1&limit=5`,
        { headers: { 'User-Agent': 'RhomeApp/1.0' } }
      );
      if (res.ok) setCityResults(await res.json());
    } catch { setCityResults([]); }
    finally { setCityLoading(false); }
  }, []);

  const handleCityTextChange = useCallback((text: string) => {
    setCity(text);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    cityDebounceRef.current = setTimeout(() => searchCity(text), 350);
  }, [searchCity]);

  const handleCitySelect = useCallback((result: any) => {
    const addr = result.address || {};
    const displayParts = (result.display_name || '').split(',').map((s: string) => s.trim());

    let cityName = '';
    if (addr.borough && addr.borough !== addr.city) {
      cityName = addr.borough;
    } else if (addr.suburb && addr.city && addr.suburb !== addr.city) {
      cityName = addr.suburb;
    } else if (addr.city) {
      cityName = addr.city;
    } else if (addr.town) {
      cityName = addr.town;
    } else {
      cityName = displayParts[0] || '';
    }

    const stateName = addr.state || '';
    const zip = addr.postcode || '';
    const neighborhoodName = addr.neighbourhood || (addr.suburb && addr.suburb !== cityName ? addr.suburb : '') || '';

    if (cityName) setCity(cityName);
    if (stateName) setState(stateName);
    if (zip) setZipCode(zip);
    if (neighborhoodName) setNeighborhood(neighborhoodName);
    if (result.lat && result.lon) setCoordinates({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setCityResults([]);
  }, []);

  const [hostLivesIn, setHostLivesIn] = useState(false);
  const [existingRoommatesCount, setExistingRoommatesCount] = useState(0);
  const [requiresBackgroundCheck, setRequiresBackgroundCheck] = useState(false);
  const [preferredTenantGender, setPreferredTenantGender] = useState<'any' | 'female_only' | 'male_only'>('any');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignedAgentId, setAssignedAgentId] = useState<string>('');
  const [companyAgents, setCompanyAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [unitNumber, setUnitNumber] = useState('');
  const [leaseTerm, setLeaseTerm] = useState<'month_to_month' | '6_months' | '12_months' | '24_months'>('12_months');
  const [petPolicy, setPetPolicy] = useState<'no_pets' | 'cats_only' | 'dogs_only' | 'cats_and_dogs' | 'all_pets'>('no_pets');
  const [parkingType, setParkingType] = useState<'none' | 'street' | 'lot' | 'garage' | 'covered'>('none');
  const [mlsNumber, setMlsNumber] = useState('');
  const isCompanyHost = user?.hostType === 'company';
  const isAgent = user?.hostType === 'agent';
  const isProfessionalHost = isCompanyHost || isAgent;
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [overageMessage, setOverageMessage] = useState('');
  const [overageResolve, setOverageResolve] = useState<((v: boolean) => void) | null>(null);

  const [currentStep, setCurrentStep] = useState(0);

  const steps = useMemo(() => {
    const base: { key: string; title: string; subtitle: string }[] = [
      { key: 'type', title: 'What type of listing is this?', subtitle: 'Tell us about the property type' },
      { key: 'location', title: 'Where is your property?', subtitle: 'This helps match you with nearby renters' },
      {
        key: 'details',
        title: 'Describe your place',
        subtitle: isProfessionalHost
          ? (isAgent ? 'Provide property details for prospective tenants' : 'Add property details to your portfolio listing')
          : 'Help renters understand what makes your place special',
      },
      { key: 'pricing', title: 'Set your price', subtitle: 'Price competitively to attract renters faster' },
    ];

    if (!isProfessionalHost) {
      base.push({ key: 'living', title: 'Who lives here?', subtitle: 'This helps renters know about the living arrangement' });
    }

    base.push(
      { key: 'photos', title: 'Add photos', subtitle: 'Great photos get 3x more interest. First photo is your cover.' },
      {
        key: 'amenities',
        title: 'Amenities & house rules',
        subtitle: isProfessionalHost ? 'Select property amenities and set policies' : 'Select what your place offers',
      },
    );

    if (isCompanyHost) {
      base.push({ key: 'agent', title: 'Assign an agent', subtitle: 'Select a team member to manage this listing' });
    }

    base.push({ key: 'review', title: 'Review your listing', subtitle: 'Make sure everything looks good before publishing' });

    return base;
  }, [isProfessionalHost, isCompanyHost, isAgent]);

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

  useEffect(() => {
    if (isProfessionalHost && !isEditing) {
      setHostLivesIn(false);
      setExistingRoommatesCount(0);
    }
  }, [isProfessionalHost, isEditing]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentStep]);

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
    if (prop.unit_number) setUnitNumber(prop.unit_number);
    if (prop.lease_term) setLeaseTerm(prop.lease_term);
    if (prop.pet_policy) setPetPolicy(prop.pet_policy);
    if (prop.parking_type) setParkingType(prop.parking_type);
    if (prop.mls_number) setMlsNumber(prop.mls_number);

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
      const uploadedUrl = await uploadListingPhoto(user!.id, asset.uri, asset.fileName || `photo_${Date.now()}.jpg`);
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

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    setPhotos(prev => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
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

      let savedCoords: any = coordinates;
      if (!savedCoords) {
        try {
          savedCoords = await geocodeAddress(address.trim(), city.trim(), state.trim());
        } catch {}
      }

      const transitInfo = {
        stops: [],
        noTransitNearby: !transitOverride.trim() || transitOverride === 'No major transit stations found nearby',
        manualOverride: transitOverride.trim() || undefined,
        fetchedAt: new Date().toISOString(),
      };

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
      if (isProfessionalHost) {
        supaData.host_lives_in = false;
        if (unitNumber.trim()) supaData.unit_number = unitNumber.trim();
        supaData.lease_term = leaseTerm;
        supaData.pet_policy = petPolicy;
        supaData.parking_type = parkingType;
      }
      if (isAgent && mlsNumber.trim()) {
        supaData.mls_number = mlsNumber.trim();
      }
      if (savedCoords) supaData.coordinates = savedCoords;
      if (transitInfo) supaData.transit_info = transitInfo;
      if (isCompanyHost && assignedAgentId) supaData.assigned_agent_id = assignedAgentId;

      let createdListingId: string | null = null;
      try {
        if (isEditing && propertyId) {
          await updateListingSupa(propertyId, supaData);
        } else {
          const created = await createListingSupa(user!.id, supaData);
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

  const goToStep = (stepKey: string) => {
    const idx = steps.findIndex(s => s.key === stepKey);
    if (idx !== -1) animateStep(idx);
  };

  const animateStep = (nextStep: number) => {
    const dir = nextStep > currentStep ? 1 : -1;
    slideAnim.setValue(dir * SCREEN_WIDTH * 0.25);
    setCurrentStep(nextStep);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const validateStep = async (stepKey: string): Promise<boolean> => {
    switch (stepKey) {
      case 'type':
        return true;
      case 'location':
        if (!city.trim()) {
          await showAlert({ title: 'Required', message: 'Please enter a city', variant: 'warning' });
          return false;
        }
        if (!address.trim()) {
          await showAlert({ title: 'Required', message: 'Please enter an address', variant: 'warning' });
          return false;
        }
        return true;
      case 'details':
        if (!title.trim()) {
          await showAlert({ title: 'Required', message: 'Please enter a listing title', variant: 'warning' });
          return false;
        }
        return true;
      case 'pricing': {
        if (!price || price <= 0) {
          await showAlert({ title: 'Required', message: 'Please set a valid rent price', variant: 'warning' });
          return false;
        }
        if (isProfessionalHost && roomType === 'room') {
          const ra = bedrooms - existingRoommatesCount;
          if (ra < 1) {
            await showAlert({ title: 'Invalid', message: 'Must have at least 1 room available', variant: 'warning' });
            return false;
          }
        }
        return true;
      }
      case 'living': {
        const ra = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
        if (ra < 1) {
          await showAlert({ title: 'Invalid', message: 'Must have at least 1 room available for renters', variant: 'warning' });
          return false;
        }
        return true;
      }
      case 'agent':
        if (!assignedAgentId) {
          await showAlert({ title: 'Agent Required', message: 'Please select a team member to manage this listing', variant: 'warning' });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const stepData = steps[currentStep];
    if (!stepData) return;

    if (stepData.key === 'review') {
      const result = validateAllForPublish();
      if (result.failedStep) {
        await showAlert({ title: 'Missing Info', message: result.message || 'Please complete all required fields', variant: 'warning' });
        goToStep(result.failedStep);
        return;
      }
      if (result.showLimit) return;
      handleSave();
      return;
    }

    const valid = await validateStep(stepData.key);
    if (!valid) return;

    if (stepData.key === 'photos' && photos.length === 0) {
      const wantToAdd = await confirm({
        title: 'No Photos Added',
        message: 'Listings with photos get 5x more views. Add at least one?',
        confirmText: 'Add Photos',
      });
      if (wantToAdd) return;
    }

    if (currentStep < steps.length - 1) {
      animateStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigation.goBack();
    } else {
      animateStep(currentStep - 1);
    }
  };

  const validateAllForPublish = (): { failedStep?: string; message?: string; showLimit?: boolean } => {
    if (!title.trim()) return { failedStep: 'details', message: 'Please enter a listing title' };
    if (!price || price <= 0) return { failedStep: 'pricing', message: 'Please set a valid rent price' };
    if (!city.trim()) return { failedStep: 'location', message: 'Please enter a city' };
    if (isCompanyHost && !assignedAgentId) return { failedStep: 'agent', message: 'Please assign an agent' };
    const roomsAvail = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
    if (roomsAvail < 1) return { failedStep: isProfessionalHost ? 'pricing' : 'living', message: 'Must have at least 1 room available' };
    if (!isEditing) {
      if (!hostSub) return { failedStep: undefined, message: 'Unable to verify plan. Please try again.' };
      const capResult = canAddListing(hostSub.activeListingCount || 0);
      if (!capResult.allowed) {
        setLimitMessage(capResult.reason || 'You have reached your listing limit.');
        setShowLimitModal(true);
        return { showLimit: true };
      }
    }
    return {};
  };

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

  const renderSelectionCard = (
    icon: string,
    label: string,
    description: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      style={[wiz.selectionCard, selected && wiz.selectionCardSelected]}
      onPress={onPress}
    >
      <View style={wiz.selectionCardIconWrap}>
        <Feather name={icon as any} size={24} color={selected ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[wiz.selectionCardLabel, selected && { color: '#fff' }]}>{label}</Text>
        <Text style={wiz.selectionCardDesc}>{description}</Text>
      </View>
      {selected ? <Feather name="check-circle" size={20} color="#ff6b5b" /> : null}
    </Pressable>
  );

  const renderStepper = (
    label: string,
    hint: string,
    value: number,
    onDecrement: () => void,
    onIncrement: () => void,
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <Text style={wiz.hintText}>{hint}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 }}>
        <Pressable
          style={[styles.chip, styles.chipUnselected, { width: 44, height: 44 }]}
          onPress={onDecrement}
        >
          <Text style={[styles.chipText, { color: 'rgba(255,255,255,0.45)' }]}>-</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', minWidth: 30, textAlign: 'center' }}>
          {value}
        </Text>
        <Pressable
          style={[styles.chip, styles.chipUnselected, { width: 44, height: 44 }]}
          onPress={onIncrement}
        >
          <Text style={[styles.chipText, { color: 'rgba(255,255,255,0.45)' }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRoomsAvailableIndicator = () => {
    const roomsAvailable = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
    return (
      <View style={wiz.roomsAvailPill}>
        <Feather name="key" size={16} color="#ff6b5b" />
        <Text style={wiz.roomsAvailText}>
          {roomsAvailable} room{roomsAvailable !== 1 ? 's' : ''} available to fill
        </Text>
      </View>
    );
  };

  const renderTypeStep = () => (
    <View>
      <Text style={wiz.stepLabel}>Listing Type</Text>
      {renderSelectionCard('file-text', 'Lease', 'A standard lease agreement', propertyType === 'lease', () => setPropertyType('lease'))}
      {renderSelectionCard('clock', 'Sublet', 'Temporary sublease of an existing lease', propertyType === 'sublet', () => setPropertyType('sublet'))}

      <Text style={[wiz.stepLabel, { marginTop: 28 }]}>Room Type</Text>
      {renderSelectionCard('home', 'Entire Place', 'Renters get the whole apartment/house', roomType === 'entire', () => {
        setRoomType('entire');
        setPreferredTenantGender('any');
        if (isProfessionalHost) setExistingRoommatesCount(0);
      })}
      {renderSelectionCard('user', 'Private Room', 'Renters get a private room in a shared space', roomType === 'room', () => setRoomType('room'))}
    </View>
  );

  const renderLocationStep = () => (
    <View>
      <View style={[styles.fieldContainer, { zIndex: 1000, elevation: 1000 }]}>
        <Text style={styles.label}>Address</Text>
        <View>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={handleAddressTextChange}
            placeholder="Start typing your address..."
            placeholderTextColor="#666"
          />
          {addressLoading ? (
            <ActivityIndicator size="small" color="#ff6b5b" style={{ position: 'absolute', right: 16, top: 15 }} />
          ) : null}
          {addressResults.length > 0 ? (
            <View style={autocompleteStyles.dropdown}>
              <FlatList
                data={addressResults}
                keyExtractor={(item) => String(item.place_id)}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <Pressable style={autocompleteStyles.row} onPress={() => handleAddressSelect(item)}>
                    <Text style={autocompleteStyles.rowText} numberOfLines={2}>{item.display_name}</Text>
                  </Pressable>
                )}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.fieldContainer, { zIndex: 999, elevation: 999 }]}>
        <Text style={styles.label}>City</Text>
        <View>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={handleCityTextChange}
            placeholder="Type a city..."
            placeholderTextColor="#666"
          />
          {cityLoading ? (
            <ActivityIndicator size="small" color="#ff6b5b" style={{ position: 'absolute', right: 16, top: 15 }} />
          ) : null}
          {cityResults.length > 0 ? (
            <View style={autocompleteStyles.dropdown}>
              <FlatList
                data={cityResults}
                keyExtractor={(item) => String(item.place_id)}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const addr = item.address || {};
                  const label = [addr.city || addr.town || addr.village || item.display_name.split(',')[0], addr.state].filter(Boolean).join(', ');
                  return (
                    <Pressable style={autocompleteStyles.row} onPress={() => handleCitySelect(item)}>
                      <Text style={autocompleteStyles.rowText} numberOfLines={1}>{label}</Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>State</Text>
        <TextInput
          style={styles.input}
          value={state}
          onChangeText={setState}
          placeholder="NY"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Neighborhood</Text>
        <TextInput
          style={styles.input}
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="e.g. Williamsburg"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Zip Code</Text>
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

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Transportation {transitLoading ? '' : '(optional)'}
        </Text>
        {transitLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ActivityIndicator size="small" color="#ff6b5b" />
            <Text style={{ color: '#888', fontSize: 13 }}>Detecting nearby transit...</Text>
          </View>
        ) : (
          <Text style={wiz.hintText}>
            {transitOverride ? 'Auto-detected from your address. Edit if needed.' : 'We auto-detect nearby transit from your address. Override below if needed.'}
          </Text>
        )}
        <TextInput
          style={[styles.input, styles.multilineInput, { minHeight: 80 }]}
          placeholder="e.g. Near Metro Line 2, Bus Route 40, 5 min walk to station"
          placeholderTextColor="#666"
          value={transitOverride}
          onChangeText={setTransitOverride}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!transitLoading}
        />
      </View>
    </View>
  );

  const renderDetailsStep = () => (
    <View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={isProfessionalHost
            ? "e.g. Luxury 2BR at The Meridian, Unit 4B"
            : "e.g. Sunny 2BR in Williamsburg"
          }
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder={isProfessionalHost
            ? "Property highlights, building amenities, recent upgrades, neighborhood features..."
            : "Describe your listing..."
          }
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length} / 500</Text>
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Available Date</Text>
        <Pressable style={styles.datePickerButton} onPress={() => setShowAvailableDatePicker(true)}>
          <Feather name="calendar" size={18} color="#666" style={{ marginRight: 10 }} />
          <Text style={{ color: availableDate ? '#fff' : '#666', fontSize: 15, flex: 1 }}>
            {availableDate ? formatDate(availableDate) : 'Select available date'}
          </Text>
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

      {isProfessionalHost ? (
        <>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Unit / Suite #</Text>
            <TextInput
              style={styles.input}
              value={unitNumber}
              onChangeText={setUnitNumber}
              placeholder="e.g. Apt 4B, Suite 201"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Lease Term</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'Month-to-Month', value: 'month_to_month' },
                { label: '6 Months', value: '6_months' },
                { label: '12 Months', value: '12_months' },
                { label: '24 Months', value: '24_months' },
              ] as const).map(opt => {
                const selected = leaseTerm === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected, { width: 'auto' as any, paddingHorizontal: 14, height: 38 }]}
                    onPress={() => setLeaseTerm(opt.value)}
                  >
                    <Text style={[styles.chipText, { color: selected ? '#fff' : '#aaa', fontSize: 13 }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isAgent ? (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>MLS / Reference #</Text>
              <Text style={wiz.hintText}>Optional — for your internal tracking</Text>
              <TextInput
                style={styles.input}
                value={mlsNumber}
                onChangeText={setMlsNumber}
                placeholder="e.g. MLS-2024-12345"
                placeholderTextColor="#666"
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const renderPricingStep = () => (
    <View>
      <View style={[styles.fieldContainer, { alignItems: 'center' }]}>
        <Text style={styles.label}>Monthly Rent</Text>
        <Text style={wiz.heroPrice}>{formatPriceDisplay(price)}</Text>
        <Text style={wiz.heroPriceSub}>per month</Text>
        <SinglePricePicker
          value={price}
          onChange={setPrice}
          options={RENT_OPTIONS}
          height={140}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Security Deposit</Text>
        <Text style={[styles.priceDisplay, { textAlign: 'center' }]}>
          {securityDeposit === 0 ? 'None' : formatPriceDisplay(securityDeposit)}
        </Text>
        <SinglePricePicker
          value={securityDeposit}
          onChange={setSecurityDeposit}
          options={DEPOSIT_OPTIONS}
          height={120}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Square Feet</Text>
        <TextInput
          style={styles.input}
          value={sqft}
          onChangeText={setSqft}
          placeholder="800"
          placeholderTextColor="#666"
          keyboardType="numeric"
        />
      </View>

      {renderNumberSelector('Bedrooms', BEDROOM_OPTIONS, bedrooms, (n) => {
        setBedrooms(n);
        const maxExisting = n - (hostLivesIn ? 1 : 0) - 1;
        if (existingRoommatesCount > maxExisting) setExistingRoommatesCount(Math.max(0, maxExisting));
      })}
      {renderNumberSelector('Bathrooms', BATHROOM_OPTIONS, bathrooms, setBathrooms)}

      {isProfessionalHost && roomType === 'room' ? (
        <>
          <View style={wiz.divider}>
            <View style={wiz.dividerLine} />
            <Text style={wiz.dividerLabel}>Room Configuration</Text>
            <View style={wiz.dividerLine} />
          </View>
          {renderStepper(
            'Current Occupants',
            'How many people currently live in this unit?',
            existingRoommatesCount,
            () => setExistingRoommatesCount(Math.max(0, existingRoommatesCount - 1)),
            () => {
              const max = bedrooms - 1;
              setExistingRoommatesCount(Math.min(max, existingRoommatesCount + 1));
            },
          )}
          {renderRoomsAvailableIndicator()}
        </>
      ) : null}
    </View>
  );

  const renderLivingStep = () => (
    <View>
      <Text style={wiz.stepLabel}>Do you live in this unit?</Text>
      {renderSelectionCard('check', 'Yes, I live here', 'I currently live in this space', hostLivesIn, () => {
        setHostLivesIn(true);
        const maxExisting = bedrooms - 2;
        if (existingRoommatesCount > maxExisting) setExistingRoommatesCount(Math.max(0, maxExisting));
      })}
      {renderSelectionCard('x', 'No, I don\'t live here', 'I don\'t live in this property', !hostLivesIn, () => {
        setHostLivesIn(false);
        const maxExisting = bedrooms - 1;
        if (existingRoommatesCount > maxExisting) setExistingRoommatesCount(Math.max(0, maxExisting));
      })}

      <View style={{ height: 24 }} />
      {renderStepper(
        'Existing Roommates',
        'How many people already live here (not counting yourself)?',
        existingRoommatesCount,
        () => setExistingRoommatesCount(Math.max(0, existingRoommatesCount - 1)),
        () => {
          const maxExisting = bedrooms - (hostLivesIn ? 1 : 0) - 1;
          setExistingRoommatesCount(Math.min(maxExisting, existingRoommatesCount + 1));
        },
      )}
      {renderRoomsAvailableIndicator()}

      {roomType === 'room' ? (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.label}>Tenant Gender Preference</Text>
          <Text style={wiz.hintText}>Shared living spaces can specify a preference</Text>
          {([
            { key: 'any' as const, label: 'Any gender', sub: 'Open to everyone', icon: 'users' },
            { key: 'female_only' as const, label: 'Women only', sub: 'Female tenants only', icon: 'user' },
            { key: 'male_only' as const, label: 'Men only', sub: 'Male tenants only', icon: 'user' },
          ]).map(opt => {
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
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{opt.sub}</Text>
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
  );

  const renderPhotosStep = () => (
    <View>
      {photos.length > 0 ? (
        <View>
          <Pressable onPress={handleAddPhoto} disabled={uploadingPhoto || photos.length >= 8} style={{ marginBottom: 12 }}>
            <Image source={{ uri: photos[0] }} style={wiz.coverPhoto} />
            <View style={wiz.coverBadge}>
              <Text style={wiz.coverBadgeText}>Cover Photo</Text>
            </View>
            <Pressable
              style={wiz.photoRemoveBtn}
              onPress={() => handleRemovePhoto(0)}
            >
              <Feather name="x" size={14} color="#fff" />
            </Pressable>
          </Pressable>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {photos.slice(1).map((photo, idx) => {
              const actualIdx = idx + 1;
              return (
                <Pressable
                  key={actualIdx}
                  style={wiz.gridPhotoWrap}
                  onLongPress={() => handleSetCover(actualIdx)}
                >
                  <Image source={{ uri: photo }} style={wiz.gridPhoto} />
                  <Pressable
                    style={wiz.photoRemoveBtn}
                    onPress={() => handleRemovePhoto(actualIdx)}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </Pressable>
              );
            })}
            {photos.length < 8 ? (
              <Pressable
                style={[wiz.gridPhotoAdd, { opacity: uploadingPhoto ? 0.6 : 1 }]}
                onPress={handleAddPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#ff6b5b" />
                ) : (
                  <>
                    <Feather name="camera" size={24} color="#555" />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>Add Photo</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable
          style={[wiz.emptyPhotoArea, { opacity: uploadingPhoto ? 0.6 : 1 }]}
          onPress={handleAddPhoto}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator size="large" color="#ff6b5b" />
          ) : (
            <>
              <Feather name="camera" size={40} color="#555" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600', marginTop: 12 }}>
                Add your first photo
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
                Tap to browse your photo library
              </Text>
            </>
          )}
        </Pressable>
      )}
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
        Add up to 8 photos. Long-press a photo to set it as cover.
      </Text>
    </View>
  );

  const renderAmenitiesStep = () => (
    <View>
      {AMENITY_CATEGORIES.map(category => {
        const categoryAmenities = getHostAmenities().filter(a => a.category === category.key);
        if (categoryAmenities.length === 0) return null;
        const selectedCount = categoryAmenities.filter(a => selectedAmenities.includes(a.id)).length;
        const isExpanded = expandedHostCategories.has(category.key);

        return (
          <View key={category.key} style={{ marginBottom: 8 }}>
            <Pressable
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 10, paddingHorizontal: 4,
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{category.label}</Text>
                {selectedCount > 0 ? (
                  <View style={wiz.amenityBadge}>
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
                      style={[styles.amenityChip, selected ? styles.amenityChipSelected : styles.amenityChipUnselected]}
                      onPress={() => toggleAmenity(amenity.id)}
                    >
                      <Feather name={amenity.icon} size={14} color={selected ? '#fff' : '#888'} style={{ marginRight: 4 }} />
                      <Text style={[styles.amenityChipText, { color: selected ? '#fff' : '#aaa' }]}>{amenity.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={wiz.divider}>
        <View style={wiz.dividerLine} />
        <Text style={wiz.dividerLabel}>House Rules</Text>
        <View style={wiz.dividerLine} />
      </View>

      <View style={styles.fieldContainer}>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={houseRules}
          onChangeText={setHouseRules}
          placeholder={isProfessionalHost
            ? "e.g. Building quiet hours 10pm-8am, no subletting, move-in deposit required..."
            : "e.g. No smoking, quiet hours after 10pm..."
          }
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Require Background Check</Text>
        <Text style={[wiz.hintText, { marginBottom: 8 }]}>
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

      {isProfessionalHost ? (
        <>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Pet Policy</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'No Pets', value: 'no_pets', icon: 'x' },
                { label: 'Cats Only', value: 'cats_only', icon: 'heart' },
                { label: 'Dogs Only', value: 'dogs_only', icon: 'heart' },
                { label: 'Cats & Dogs', value: 'cats_and_dogs', icon: 'check' },
                { label: 'All Pets', value: 'all_pets', icon: 'check-circle' },
              ] as const).map(opt => {
                const selected = petPolicy === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected, { width: 'auto' as any, paddingHorizontal: 14, height: 38 }]}
                    onPress={() => setPetPolicy(opt.value)}
                  >
                    <Feather name={opt.icon as any} size={12} color={selected ? '#fff' : '#666'} style={{ marginRight: 4 }} />
                    <Text style={[styles.chipText, { color: selected ? '#fff' : '#aaa', fontSize: 13 }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Parking</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'None', value: 'none' },
                { label: 'Street', value: 'street' },
                { label: 'Lot', value: 'lot' },
                { label: 'Garage', value: 'garage' },
                { label: 'Covered', value: 'covered' },
              ] as const).map(opt => {
                const selected = parkingType === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected, { width: 'auto' as any, paddingHorizontal: 14, height: 38 }]}
                    onPress={() => setParkingType(opt.value)}
                  >
                    <Text style={[styles.chipText, { color: selected ? '#fff' : '#aaa', fontSize: 13 }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );

  const renderAgentStep = () => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <Feather name="users" size={18} color="#ff6b5b" />
        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Required</Text>
      </View>
      {companyAgents.length === 0 ? (
        <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
          <Text style={{ color: '#F59E0B', fontSize: 14, lineHeight: 20 }}>
            No team members found. Add agents in Team Management first.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {companyAgents.map(agent => {
            const selected = assignedAgentId === agent.id;
            return (
              <Pressable
                key={agent.id}
                style={[wiz.selectionCard, selected && wiz.selectionCardSelected, { height: 'auto' as any, minHeight: 64 }]}
                onPress={() => setAssignedAgentId(selected ? '' : agent.id)}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: selected ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Feather name={selected ? 'check' : 'user'} size={18} color={selected ? '#fff' : 'rgba(255,255,255,0.5)'} />
                </View>
                <Text style={{ color: selected ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: selected ? '600' : '400', flex: 1 }}>
                  {agent.full_name}
                </Text>
                {selected ? <Feather name="check-circle" size={20} color="#3b82f6" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const allAmenities = getHostAmenities();
  const getAmenityLabel = (id: string) => allAmenities.find(a => a.id === id)?.label || id.replace(/_/g, ' ');

  const renderReviewSection = (sectionTitle: string, stepKey: string, lines: string[]) => (
    <View style={wiz.reviewSection}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={wiz.reviewSectionTitle}>{sectionTitle}</Text>
        <Pressable onPress={() => goToStep(stepKey)}>
          <Text style={wiz.reviewEditLink}>Edit</Text>
        </Pressable>
      </View>
      {lines.map((line, i) => (
        <Text key={i} style={wiz.reviewSectionText}>{line}</Text>
      ))}
    </View>
  );

  const renderReviewStep = () => {
    const roomsAvailable = bedrooms - (hostLivesIn ? 1 : 0) - existingRoommatesCount;
    return (
      <View>
        <View style={wiz.reviewCard}>
          {photos.length > 0 ? (
            <Image source={{ uri: photos[0] }} style={wiz.reviewCoverPhoto} />
          ) : (
            <View style={wiz.reviewCoverPlaceholder}>
              <Feather name="image" size={40} color="#555" />
              <Text style={{ color: '#555', fontSize: 13, marginTop: 8 }}>No cover photo</Text>
            </View>
          )}
          <View style={{ padding: 16 }}>
            <Text style={wiz.reviewTitle}>{title || 'Untitled Listing'}</Text>
            <Text style={wiz.reviewPrice}>{formatPriceDisplay(price)}/mo</Text>
            <Text style={wiz.reviewLocation}>
              {[neighborhood, city, state].filter(Boolean).join(', ') || 'No location set'}
            </Text>
            <View style={wiz.reviewDetailsRow}>
              <Text style={wiz.reviewDetail}>{bedrooms} bd</Text>
              <Text style={wiz.reviewDot}>{'\u00B7'}</Text>
              <Text style={wiz.reviewDetail}>{bathrooms} ba</Text>
              {sqft ? (
                <>
                  <Text style={wiz.reviewDot}>{'\u00B7'}</Text>
                  <Text style={wiz.reviewDetail}>{sqft} sqft</Text>
                </>
              ) : null}
              <Text style={wiz.reviewDot}>{'\u00B7'}</Text>
              <Text style={wiz.reviewDetail}>{roomType === 'entire' ? 'Entire' : 'Room'}</Text>
            </View>
            {selectedAmenities.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {selectedAmenities.slice(0, 6).map(a => (
                  <View key={a} style={wiz.reviewAmenityChip}>
                    <Text style={wiz.reviewAmenityText}>{getAmenityLabel(a)}</Text>
                  </View>
                ))}
                {selectedAmenities.length > 6 ? (
                  <View style={wiz.reviewAmenityChip}>
                    <Text style={wiz.reviewAmenityText}>+{selectedAmenities.length - 6} more</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {renderReviewSection('Property Type', 'type', [
          `${propertyType === 'lease' ? 'Lease' : 'Sublet'} \u00B7 ${roomType === 'entire' ? 'Entire Place' : 'Private Room'}`,
        ])}
        {renderReviewSection('Location', 'location', [
          address || 'No address',
          [city, state, zipCode].filter(Boolean).join(', '),
          neighborhood ? `Neighborhood: ${neighborhood}` : '',
        ].filter(Boolean))}
        {renderReviewSection('Details', 'details', [
          title || 'No title set',
          description ? (description.length > 80 ? `${description.substring(0, 80)}...` : description) : 'No description',
          availableDate ? `Available: ${formatDate(availableDate)}` : 'Available: Immediately',
        ])}
        {renderReviewSection('Pricing', 'pricing', [
          `Rent: ${formatPriceDisplay(price)}/mo`,
          `Deposit: ${securityDeposit ? formatPriceDisplay(securityDeposit) : 'None'}`,
          `${bedrooms} bed \u00B7 ${bathrooms} bath${sqft ? ` \u00B7 ${sqft} sqft` : ''}`,
        ])}
        {!isProfessionalHost ? renderReviewSection('Living Situation', 'living', [
          `Host lives in: ${hostLivesIn ? 'Yes' : 'No'}`,
          `Existing roommates: ${existingRoommatesCount}`,
          `Rooms available: ${roomsAvailable}`,
        ]) : null}
        {renderReviewSection('Photos', 'photos', [
          `${photos.length} photo${photos.length !== 1 ? 's' : ''} uploaded`,
        ])}
        {renderReviewSection('Amenities & Rules', 'amenities', [
          `${selectedAmenities.length} amenities selected`,
          houseRules ? (houseRules.length > 60 ? `Rules: ${houseRules.substring(0, 60)}...` : `Rules: ${houseRules}`) : 'No house rules set',
        ])}
        {isCompanyHost ? renderReviewSection('Assigned Agent', 'agent', [
          assignedAgentId
            ? companyAgents.find(a => a.id === assignedAgentId)?.full_name || 'Selected'
            : 'Not assigned',
        ]) : null}

        {isEditing ? (
          <Pressable style={wiz.deleteBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={14} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>Delete listing</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderStepContent = () => {
    const stepKey = steps[currentStep]?.key;
    switch (stepKey) {
      case 'type': return renderTypeStep();
      case 'location': return renderLocationStep();
      case 'details': return renderDetailsStep();
      case 'pricing': return renderPricingStep();
      case 'living': return renderLivingStep();
      case 'photos': return renderPhotosStep();
      case 'amenities': return renderAmenitiesStep();
      case 'agent': return renderAgentStep();
      case 'review': return renderReviewStep();
      default: return null;
    }
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const headerSubtitle = useMemo(() => {
    if (isEditing) return 'Edit your listing details';
    if (isAgent) return 'Add a listing for your client';
    return 'Add a property to your portfolio';
  }, [isEditing, isAgent]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
      <View style={[wiz.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} style={wiz.topBarBackBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={wiz.topBarTitle} numberOfLines={1}>
            {currentStepData?.title || (isEditing ? 'Edit Listing' : 'New Listing')}
          </Text>
          <Text style={wiz.topBarStepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={wiz.progressBar}>
        {steps.map((step, i) => (
          <View
            key={step.key}
            style={[
              wiz.progressSegment,
              {
                flex: 1,
                backgroundColor: i <= currentStep ? '#ff6b5b' : '#222',
                marginRight: i < steps.length - 1 ? 3 : 0,
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {currentStepData?.subtitle ? (
            <Text style={wiz.stepSubtitle}>{currentStepData.subtitle}</Text>
          ) : null}
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {renderStepContent()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[wiz.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {currentStep > 0 ? (
          <Pressable onPress={handleBack} style={wiz.backBtn}>
            <Feather name="arrow-left" size={16} color="#fff" />
            <Text style={wiz.backBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}

        <Pressable
          style={[
            wiz.nextBtn,
            isLastStep && wiz.publishBtn,
            { opacity: saving ? 0.6 : 1 },
          ]}
          onPress={handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isLastStep ? (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={wiz.nextBtnText}>
                {isEditing ? 'Update Listing' : 'Publish Listing'}
              </Text>
            </>
          ) : (
            <>
              <Text style={wiz.nextBtnText}>Next</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </>
          )}
        </Pressable>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
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
    flexDirection: 'row',
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
});

const autocompleteStyles = StyleSheet.create({
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  rowText: {
    color: '#ccc',
    fontSize: 14,
  },
});

const wiz = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topBarBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  topBarStepIndicator: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 0,
  },
  progressSegment: {
    height: 4,
    borderRadius: 2,
  },
  stepSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 24,
    lineHeight: 20,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    height: 80,
    marginBottom: 10,
  },
  selectionCardSelected: {
    borderColor: '#ff6b5b',
    borderWidth: 2,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  selectionCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  selectionCardDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 8,
    lineHeight: 18,
  },
  heroPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ff6b5b',
    textAlign: 'center',
    marginBottom: 2,
  },
  heroPriceSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  roomsAvailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,91,0.08)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  roomsAvailText: {
    fontSize: 13,
    color: '#ff6b5b',
    fontWeight: '600',
  },
  coverPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 14,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255,107,91,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoRemoveBtn: {
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
  gridPhotoWrap: {
    width: PHOTO_COL_WIDTH,
    height: PHOTO_COL_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  gridPhotoAdd: {
    width: PHOTO_COL_WIDTH,
    height: PHOTO_COL_WIDTH,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotoArea: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ff6b5b',
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 120,
  },
  publishBtn: {
    flex: 1,
    marginLeft: 16,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 16,
  },
  reviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  reviewCoverPhoto: {
    width: '100%',
    height: 180,
  },
  reviewCoverPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  reviewPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6b5b',
    marginBottom: 4,
  },
  reviewLocation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  reviewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewDetail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  reviewDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
  reviewAmenityChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewAmenityText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  reviewSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 10,
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  reviewEditLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  reviewSectionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
});
