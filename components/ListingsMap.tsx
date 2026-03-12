import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Property } from '../types/models';

interface ListingsMapProps {
  listings: Property[];
  onListingPress: (listing: Property) => void;
  cityCoords: { lat: number; lng: number };
}

export const ListingsMap = ({ listings, onListingPress, cityCoords }: ListingsMapProps) => (
  <MapView
    style={{ flex: 1 }}
    userInterfaceStyle="dark"
    initialRegion={{
      latitude: cityCoords.lat,
      longitude: cityCoords.lng,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    }}
  >
    {listings.map((listing) => {
      const lat = listing.coordinates?.lat ?? cityCoords.lat + (Math.random() - 0.5) * 0.02;
      const lng = listing.coordinates?.lng ?? cityCoords.lng + (Math.random() - 0.5) * 0.02;
      return (
        <Marker
          key={listing.id}
          coordinate={{ latitude: lat, longitude: lng }}
        >
          <View style={styles.pricePin}>
            <Text style={styles.pricePinText}>${listing.rent}/mo</Text>
          </View>
          <Callout onPress={() => onListingPress(listing)}>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>{listing.title}</Text>
              <Text style={styles.calloutSub}>{listing.neighborhood || listing.location}</Text>
              <Text style={styles.calloutLink}>View listing →</Text>
            </View>
          </Callout>
        </Marker>
      );
    })}
  </MapView>
);

const styles = StyleSheet.create({
  pricePin: {
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      },
    }),
  },
  pricePinText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  callout: {
    width: 180,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  calloutSub: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calloutLink: {
    fontSize: 12,
    color: '#ff6b5b',
    fontWeight: '600',
  },
});
