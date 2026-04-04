import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Property } from '../types/models';

const DISMISSED_KEY_PREFIX = '@rhome/host_onboarding_dismissed_';

function getDismissedKey(userId: string): string {
  return `${DISMISSED_KEY_PREFIX}${userId}`;
}

export interface HostChecklistStep {
  id: string;
  title: string;
  description: string;
  tip?: string;
  completed: boolean;
  action?: {
    label: string;
    screen: string;
    params?: Record<string, any>;
    navigateVia?: 'profile';
  };
}

export interface HostChecklistStatus {
  steps: HostChecklistStep[];
  completedCount: number;
  totalSteps: number;
  allComplete: boolean;
  currentStep: HostChecklistStep | null;
  dismissed: boolean;
}

export async function getHostChecklist(
  user: User | null,
  listings: Property[],
): Promise<HostChecklistStatus> {
  if (!user) return emptyStatus();

  const dismissed = await AsyncStorage.getItem(getDismissedKey(user.id));
  if (dismissed === 'true') {
    return { ...emptyStatus(), dismissed: true };
  }

  const hasListing = listings.length > 0;
  const hasPhotos = listings.some(l => l.photos && l.photos.length >= 5);
  const hasGoodPrice = listings.some(l => l.price && l.price > 0);
  const isBoosted = listings.some(l => l.listingBoost || l.featured);
  const isVerified = (user as any).isVerified || user.purchases?.hostVerificationBadge;

  const firstListing = listings[0];
  const incompletePhotoListing = listings.find(l => !l.photos || l.photos.length < 5);
  const incompletePriceListing = listings.find(l => !l.price || l.price <= 0);
  const unboostedListing = listings.find(l => !l.listingBoost && !l.featured);

  const steps: HostChecklistStep[] = [
    {
      id: 'account',
      title: 'Create your account',
      description: 'Sign up and set your host type',
      completed: true,
    },
    {
      id: 'verify',
      title: 'Verify your identity',
      description: 'Build trust with renters by verifying your ID',
      tip: 'Verified hosts get 2x more inquiries',
      completed: !!isVerified,
      action: !isVerified ? {
        label: 'Get Verified',
        screen: 'Verification',
        navigateVia: 'profile',
      } : undefined,
    },
    {
      id: 'first_listing',
      title: 'Add your first listing',
      description: 'Create a listing with address, price, and details',
      tip: 'Most hosts get their first inquiry within 48 hours',
      completed: hasListing,
      action: !hasListing ? {
        label: 'Create Listing',
        screen: 'CreateEditListing',
      } : undefined,
    },
    {
      id: 'photos',
      title: 'Upload 5+ listing photos',
      description: 'Show off your space with high-quality photos',
      tip: 'Listings with 5+ photos get 3x more inquiries',
      completed: hasPhotos,
      action: !hasPhotos && hasListing ? {
        label: 'Add Photos',
        screen: 'CreateEditListing',
        params: { propertyId: (incompletePhotoListing || firstListing)?.id, scrollTo: 'photos' },
      } : !hasListing ? {
        label: 'Create Listing First',
        screen: 'CreateEditListing',
      } : undefined,
    },
    {
      id: 'pricing',
      title: 'Set competitive pricing',
      description: 'Price your listing based on your neighborhood market',
      tip: 'Well-priced listings rent 40% faster',
      completed: hasGoodPrice,
      action: !hasGoodPrice && hasListing ? {
        label: 'Set Price',
        screen: 'CreateEditListing',
        params: { propertyId: (incompletePriceListing || firstListing)?.id, scrollTo: 'price' },
      } : undefined,
    },
    {
      id: 'boost',
      title: 'Boost your listing',
      description: 'Get to the top of search results for more visibility',
      tip: 'Boosted listings get 5x more views in the first 24 hours',
      completed: isBoosted,
      action: !isBoosted && hasListing ? {
        label: 'Boost Now',
        screen: 'ListingBoost',
        params: { listingId: (unboostedListing || firstListing)?.id },
      } : undefined,
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const currentStep = steps.find(s => !s.completed) || null;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    allComplete: completedCount === steps.length,
    currentStep,
    dismissed: false,
  };
}

export async function dismissHostChecklist(userId: string) {
  await AsyncStorage.setItem(getDismissedKey(userId), 'true');
}

export async function resetHostChecklist(userId: string) {
  await AsyncStorage.removeItem(getDismissedKey(userId));
}

function emptyStatus(): HostChecklistStatus {
  return {
    steps: [],
    completedCount: 0,
    totalSteps: 6,
    allComplete: false,
    currentStep: null,
    dismissed: false,
  };
}
