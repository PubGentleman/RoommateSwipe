import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, User } from '../types/models';

const PRICE_HISTORY_KEY = '@rhome/listing_price_history';

export interface RecommendationSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  listings: Property[];
  type: 'featured' | 'horizontal' | 'compact';
}

export async function generateRecommendations(
  listings: Property[],
  user: User,
): Promise<RecommendationSection[]> {
  const sections: RecommendationSection[] = [];
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const userBudget = user.profileData?.budget || 2000;
  const userNeighborhoods = user.preferred_neighborhoods || [];

  const scored = listings
    .filter(l => l.price && l.price <= userBudget * 1.15)
    .map(l => ({
      listing: l,
      score: computeListingMatchScore(l, user),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    sections.push({
      id: 'best-match',
      title: 'Best Match Today',
      subtitle: 'Handpicked based on your preferences',
      icon: 'award',
      iconColor: '#FFD700',
      listings: [scored[0].listing],
      type: 'featured',
    });
  }

  const newListings = listings
    .filter(l => {
      const created = new Date(l.createdAt || '');
      return created >= oneWeekAgo;
    })
    .sort((a, b) => {
      const aDate = new Date(a.createdAt || '').getTime();
      const bDate = new Date(b.createdAt || '').getTime();
      return bDate - aDate;
    })
    .slice(0, 10);

  if (newListings.length >= 2) {
    sections.push({
      id: 'new-this-week',
      title: 'New This Week',
      subtitle: `${newListings.length} fresh listings`,
      icon: 'zap',
      iconColor: '#6366f1',
      listings: newListings,
      type: 'horizontal',
    });
  }

  const priceDrops = await findPriceDrops(listings);
  if (priceDrops.length > 0) {
    sections.push({
      id: 'price-drops',
      title: 'Price Drops',
      subtitle: 'Recently reduced rent',
      icon: 'trending-down',
      iconColor: '#3ECF8E',
      listings: priceDrops,
      type: 'horizontal',
    });
  }

  await savePriceSnapshot(listings);

  if (userNeighborhoods.length > 0) {
    const neighborhoodListings = listings
      .filter(l =>
        l.neighborhood && userNeighborhoods.some(
          (n: string) => n.toLowerCase() === l.neighborhood?.toLowerCase()
        )
      )
      .slice(0, 10);

    if (neighborhoodListings.length >= 2) {
      sections.push({
        id: 'your-neighborhoods',
        title: 'In Your Neighborhoods',
        subtitle: userNeighborhoods.slice(0, 3).join(', '),
        icon: 'map-pin',
        iconColor: '#ff6b5b',
        listings: neighborhoodListings,
        type: 'horizontal',
      });
    }
  }

  const quickMoveIn = listings
    .filter(l => {
      if (!l.availableDate) return true;
      const avail = new Date(l.availableDate);
      return avail <= thirtyDaysOut;
    })
    .sort((a, b) => {
      const aDate = new Date(a.availableDate || '2000-01-01').getTime();
      const bDate = new Date(b.availableDate || '2000-01-01').getTime();
      return aDate - bDate;
    })
    .slice(0, 10);

  if (quickMoveIn.length >= 2) {
    sections.push({
      id: 'quick-move-in',
      title: 'Quick Move-In',
      subtitle: 'Available now or within 30 days',
      icon: 'clock',
      iconColor: '#f59e0b',
      listings: quickMoveIn,
      type: 'compact',
    });
  }

  return sections;
}

function computeListingMatchScore(listing: Property, user: User): number {
  let score = 50;

  const userBudget = user.profileData?.budget || 2000;
  if (listing.price) {
    const ratio = listing.price / userBudget;
    if (ratio <= 1.0) score += 30;
    else if (ratio <= 1.1) score += 20;
    else if (ratio <= 1.2) score += 10;
  }

  const userNeighborhoods = user.preferred_neighborhoods || [];
  if (listing.neighborhood && userNeighborhoods.some(
    (n: string) => n.toLowerCase() === listing.neighborhood?.toLowerCase()
  )) {
    score += 20;
  } else if (listing.city?.toLowerCase() === (user.profileData?.city || user.city || '').toLowerCase()) {
    score += 10;
  }

  if (listing.photos && listing.photos.length >= 3) score += 5;
  if (listing.average_rating && listing.average_rating >= 4) score += 5;
  if (listing.host_badge) score += 5;
  if (listing.transitInfo?.stops && listing.transitInfo.stops.length > 0) score += 5;

  if (listing.createdAt) {
    const daysSinceCreated = (Date.now() - new Date(listing.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 3) score += 10;
    else if (daysSinceCreated < 7) score += 7;
    else if (daysSinceCreated < 14) score += 3;
  }

  return score;
}

async function findPriceDrops(listings: Property[]): Promise<Property[]> {
  try {
    const stored = await AsyncStorage.getItem(PRICE_HISTORY_KEY);
    if (!stored) return [];
    const history: Record<string, number> = JSON.parse(stored);

    return listings.filter(l => {
      if (!l.id || !l.price) return false;
      const prevPrice = history[l.id];
      return prevPrice && l.price < prevPrice;
    });
  } catch {
    return [];
  }
}

async function savePriceSnapshot(listings: Property[]) {
  try {
    const snapshot: Record<string, number> = {};
    listings.forEach(l => {
      if (l.id && l.price) snapshot[l.id] = l.price;
    });
    await AsyncStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(snapshot));
  } catch {}
}
