import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import { Property } from '../types/models';
import { RecommendationSection as RecSection } from '../utils/recommendationEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const COMPACT_CARD_WIDTH = SCREEN_WIDTH * 0.42;

interface Props {
  section: RecSection;
  onListingPress: (listing: Property) => void;
  onSeeAll?: () => void;
}

const RecommendationSectionComponent: React.FC<Props> = ({ section, onListingPress, onSeeAll }) => {
  if (section.type === 'featured') {
    return <FeaturedCard section={section} onPress={() => onListingPress(section.listings[0])} />;
  }

  const cardWidth = section.type === 'compact' ? COMPACT_CARD_WIDTH : CARD_WIDTH;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, { backgroundColor: section.iconColor + '15' }]}>
            <Feather name={section.icon as any} size={14} color={section.iconColor} />
          </View>
          <View>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.subtitle}>{section.subtitle}</Text>
          </View>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={section.listings}
        keyExtractor={(item) => `rec-${section.id}-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { width: cardWidth }]}
            onPress={() => onListingPress(item)}
          >
            {item.photos && item.photos.length > 0 ? (
              <Image
                source={{ uri: item.photos[0] }}
                style={[styles.cardImage, { width: cardWidth, height: section.type === 'compact' ? 100 : 140 }]}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.cardImagePlaceholder, { width: cardWidth, height: section.type === 'compact' ? 100 : 140 }]}>
                <Feather name="home" size={24} color="rgba(255,255,255,0.15)" />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardPrice}>
                ${item.price?.toLocaleString()}<Text style={styles.pricePeriod}>/mo</Text>
              </Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardLocation} numberOfLines={1}>
                {item.neighborhood ? `${item.neighborhood}, ` : ''}{item.city}
              </Text>
              {item.bedrooms ? (
                <Text style={styles.cardMeta}>
                  {item.bedrooms} bd · {item.bathrooms} ba
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

const FeaturedCard: React.FC<{ section: RecSection; onPress: () => void }> = ({ section, onPress }) => {
  const listing = section.listings[0];
  if (!listing) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, { backgroundColor: section.iconColor + '15' }]}>
            <Feather name={section.icon as any} size={14} color={section.iconColor} />
          </View>
          <View>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.subtitle}>{section.subtitle}</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.featuredCard} onPress={onPress}>
        {listing.photos && listing.photos.length > 0 ? (
          <Image
            source={{ uri: listing.photos[0] }}
            style={styles.featuredImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.featuredImage, { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="home" size={40} color="rgba(255,255,255,0.15)" />
          </View>
        )}
        <View style={styles.featuredOverlay}>
          <View style={styles.featuredBadge}>
            <Feather name="award" size={12} color="#FFD700" />
            <Text style={styles.featuredBadgeText}>Best Match</Text>
          </View>
        </View>
        <View style={styles.featuredBody}>
          <Text style={styles.featuredPrice}>
            ${listing.price?.toLocaleString()}<Text style={styles.pricePeriod}>/mo</Text>
          </Text>
          <Text style={styles.featuredTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.cardLocation}>
            {listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city}
            {listing.bedrooms ? ` · ${listing.bedrooms} bd ${listing.bathrooms} ba` : ''}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#ff6b5b' },

  card: {
    backgroundColor: '#161616',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImage: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  cardImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 10, gap: 2 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#fff' },
  pricePeriod: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.4)' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  cardLocation: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  cardMeta: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 },

  featuredCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  featuredImage: { width: '100%', height: 200 },
  featuredOverlay: {
    position: 'absolute', top: 12, left: 12,
  },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  featuredBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFD700' },
  featuredBody: { padding: 14, gap: 3 },
  featuredPrice: { fontSize: 20, fontWeight: '800', color: '#fff' },
  featuredTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

export default RecommendationSectionComponent;
