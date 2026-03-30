import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Property, User, RoommateProfile } from '../types/models';
import { Feather } from './VectorIcons';
import { formatLocation, getMatchQualityColor, calculateCompatibility } from '../utils/matchingAlgorithm';

interface PropertyMapViewProps {
  properties: Property[];
  saved: Set<string>;
  hostProfiles: Map<string, User>;
  currentUser: User | null;
  onPropertyPress: (property: Property) => void;
  onToggleSave: (id: string) => void;
  bottomInset: number;
}

function getUserAsRoommateProfile(user: User): RoommateProfile {
  return {
    id: user.id,
    name: user.name || 'Unknown',
    age: user.age || 25,
    gender: user.profileData?.gender || 'other',
    occupation: user.profileData?.occupation || '',
    location: user.profileData?.location || { neighborhood: '', city: '', state: '' },
    budget: user.profileData?.budget || 1500,
    moveInDate: user.profileData?.moveInDate || '',
    bio: user.profileData?.bio || '',
    interests: user.profileData?.interests || '',
    profilePicture: user.profilePicture || '',
    photos: user.photos || [],
    zodiacSign: user.zodiacSign,
    preferences: user.profileData?.preferences || {
      sleepSchedule: 'flexible',
      cleanliness: 'moderate',
      guestPolicy: 'sometimes',
      noiseTolerance: 'moderate',
      smoking: 'no',
      workLocation: 'hybrid',
      roommateRelationship: 'occasional_hangouts',
      pets: 'no_pets',
    },
    matchPreferences: user.profileData?.matchPreferences,
    dateOfBirth: user.dateOfBirth,
  };
}

function buildLeafletHtml(
  properties: { id: string; lat: number; lng: number; price: number; title: string; beds: number; baths: number; photo: string; matchPct: number | null; matchColor: string; isSaved: boolean }[],
  center: { lat: number; lng: number },
  zoom: number,
  isDark: boolean
): string {
  const markersJson = JSON.stringify(properties);
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%}
.popup-card{font-family:-apple-system,system-ui,sans-serif;width:220px;overflow:hidden;border-radius:12px;background:${isDark ? '#1a1a1a' : '#fff'};box-shadow:0 4px 20px rgba(0,0,0,0.3)}
.popup-card img{width:100%;height:110px;object-fit:cover;display:block}
.popup-info{padding:10px 12px}
.popup-price{font-size:15px;font-weight:700;color:${isDark ? '#fff' : '#111'}}
.popup-title{font-size:11px;color:${isDark ? 'rgba(255,255,255,0.5)' : '#888'};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.popup-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
.popup-beds{font-size:11px;color:${isDark ? 'rgba(255,255,255,0.5)' : '#888'}}
.popup-match{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px}
.leaflet-popup-content-wrapper{padding:0!important;border-radius:12px!important;background:transparent!important;box-shadow:none!important}
.leaflet-popup-content{margin:0!important;width:auto!important}
.leaflet-popup-tip{display:none}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${center.lat},${center.lng}],${zoom});
L.tileLayer('${tileUrl}',{attribution:'',maxZoom:19}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
var markers=${markersJson};
markers.forEach(function(m){
  var photoHtml = m.photo
    ? '<img src="'+m.photo+'" style="width:44px;height:44px;object-fit:cover;border-radius:50%;display:block" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<div style=\\\"width:44px;height:44px;border-radius:50%;background:#ff6b5b;display:flex;align-items:center;justify-content:center;font-size:18px\\\">&#127968;</div>\'">'
    : '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ff6b5b,#e83a2a);display:flex;align-items:center;justify-content:center;font-size:18px">&#127968;</div>';

  var icon=L.divIcon({
    className:'',
    html:'<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">'
      +'<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35)">'
        +photoHtml
      +'</div>'
      +'<div style="background:linear-gradient(135deg,#ff6b5b,#e83a2a);color:#fff;font-weight:700;font-size:11px;font-family:-apple-system,system-ui,sans-serif;padding:3px 9px;border-radius:20px;margin-top:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(255,80,60,0.45);border:1.5px solid rgba(255,255,255,0.25)">$'+m.price.toLocaleString()+'</div>'
      +'<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #e83a2a;margin-top:-1px"></div>'
    +'</div>',
    iconSize:[44,70],
    iconAnchor:[22,70]
  });
  var popup='<div class="popup-card" onclick="window.parent.postMessage(JSON.stringify({type:\\'propertyTap\\',id:\\''+m.id+'\\',token:\\'__MSG_TOKEN__\\'}),\\'*\\')">'
    +'<img src="'+m.photo+'"/>'
    +'<div class="popup-info">'
    +'<div class="popup-price">$'+m.price+'/mo</div>'
    +'<div class="popup-title">'+m.title+'</div>'
    +'<div class="popup-meta"><span class="popup-beds">'+m.beds+'bd '+m.baths+'ba</span>'
    +(m.matchPct!==null?'<span class="popup-match" style="background:'+m.matchColor+'20;color:'+m.matchColor+'">'+m.matchPct+'%</span>':'')
    +'</div></div></div>';
  L.marker([m.lat,m.lng],{icon:icon}).addTo(map).bindPopup(popup,{maxWidth:240,minWidth:220});
});
if(markers.length>1){
  var bounds=L.latLngBounds(markers.map(function(m){return[m.lat,m.lng]}));
  map.fitBounds(bounds,{padding:[40,40]});
}
</script>
</body></html>`;
}

export const PropertyMapView = ({
  properties,
  saved,
  hostProfiles,
  currentUser,
  onPropertyPress,
  onToggleSave,
  bottomInset,
}: PropertyMapViewProps) => {
  const { theme, isDark } = useTheme();

  const propertiesWithCoords = useMemo(
    () => properties.filter(p => p.coordinates?.lat && p.coordinates?.lng),
    [properties]
  );

  const initialRegion = useMemo(() => {
    if (propertiesWithCoords.length === 0) {
      const userCoords = currentUser?.profileData?.coordinates;
      if (userCoords) {
        return { latitude: userCoords.lat, longitude: userCoords.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 };
      }
      return { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }
    const lats = propertiesWithCoords.map(p => p.coordinates!.lat);
    const lngs = propertiesWithCoords.map(p => p.coordinates!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.3, 0.01);
    const padLng = Math.max((maxLng - minLng) * 0.3, 0.01);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + padLat,
      longitudeDelta: maxLng - minLng + padLng,
    };
  }, [propertiesWithCoords, currentUser]);

  const mapMarkers = useMemo(() => {
    return propertiesWithCoords.map(property => {
      const hostUser = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
      const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
      const compatibility = hostProfile && currentUser ? calculateCompatibility(currentUser, hostProfile) : null;
      return {
        id: property.id,
        lat: property.coordinates!.lat,
        lng: property.coordinates!.lng,
        price: property.price,
        title: property.title,
        beds: property.bedrooms,
        baths: property.bathrooms,
        photo: property.photos[0] || '',
        matchPct: compatibility,
        matchColor: compatibility !== null ? getMatchQualityColor(compatibility) : '',
        isSaved: saved.has(property.id),
      };
    });
  }, [propertiesWithCoords, hostProfiles, currentUser, saved]);

  const [mapError, setMapError] = useState(false);

  if (Platform.OS === 'web') {
    const htmlContent = buildLeafletHtml(
      mapMarkers,
      { lat: initialRegion.latitude, lng: initialRegion.longitude },
      12,
      isDark
    );

    const messageToken = React.useRef(`rhome_map_${Date.now()}_${Math.random().toString(36).slice(2)}`).current;
    const htmlWithToken = htmlContent.replace('__MSG_TOKEN__', messageToken);

    React.useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'propertyTap' && data.token === messageToken) {
            const property = properties.find(p => p.id === data.id);
            if (property) onPropertyPress(property);
          }
        } catch {}
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [properties, messageToken, onPropertyPress]);

    return (
      <View style={[styles.mapContainer, { paddingBottom: bottomInset }]}>
        <iframe
          srcDoc={htmlWithToken}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
        />
        <View style={[styles.propertyCount, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="map-pin" size={14} color={theme.primary} />
          <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.xs, fontWeight: '600' }]}>
            {propertiesWithCoords.length} {propertiesWithCoords.length === 1 ? 'property' : 'properties'}
          </ThemedText>
        </View>
      </View>
    );
  }

  const MapView = require('react-native-maps').default;
  const { Marker, Callout, PROVIDER_GOOGLE } = require('react-native-maps');
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  if (mapError) {
    return (
      <View style={[styles.mapContainer, styles.mapErrorContainer]}>
        <Feather name="map-pin" size={40} color="rgba(255,255,255,0.2)" />
        <Text style={styles.mapErrorText}>Map couldn't load</Text>
        <Text style={styles.mapErrorSubtext}>Check your connection and try again</Text>
        <Pressable
          onPress={() => setMapError(false)}
          style={styles.mapRetryBtn}
        >
          <Text style={styles.mapRetryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        provider={mapProvider}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsCompass={true}
        showsScale={true}
        onMapReady={() => console.log('[PropertyMapView] Map loaded successfully')}
        onError={(e: { nativeEvent?: { error?: string } }) => {
          console.error('[PropertyMapView] Map failed to load:', e.nativeEvent?.error || e);
          setMapError(true);
        }}
      >
        {propertiesWithCoords.map(property => {
          const hostUser = property.hostProfileId ? hostProfiles.get(property.hostProfileId) : null;
          const hostProfile = hostUser ? getUserAsRoommateProfile(hostUser) : null;
          const compatibility = hostProfile && currentUser ? calculateCompatibility(currentUser, hostProfile) : null;

          return (
            <Marker
              key={property.id}
              coordinate={{
                latitude: property.coordinates!.lat,
                longitude: property.coordinates!.lng,
              }}
              tracksViewChanges={false}
              onPress={() => onPropertyPress(property)}
            >
              <View style={styles.pinWrap}>
                <View style={[
                  styles.pinPhotoRing,
                  saved.has(property.id) && styles.pinPhotoRingSaved,
                ]}>
                  {property.photos[0] ? (
                    <Image
                      source={{ uri: property.photos[0] }}
                      style={styles.pinPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.pinPhotoFallback}>
                      <Text style={styles.pinPhotoFallbackIcon}>&#127968;</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.pinPricePill, saved.has(property.id) && styles.pinPricePillSaved]}>
                  <Text style={styles.pinPriceText}>${property.price.toLocaleString()}</Text>
                </View>
                <View style={[styles.pinTip, saved.has(property.id) && styles.pinTipSaved]} />
              </View>

              <Callout tooltip onPress={() => onPropertyPress(property)}>
                <View style={[styles.callout, { backgroundColor: theme.backgroundDefault }]}>
                  <Image source={{ uri: property.photos[0] }} style={styles.calloutImage} />
                  <View style={styles.calloutInfo}>
                    <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
                      ${property.price}/mo
                    </ThemedText>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]} numberOfLines={1}>
                      {property.title}
                    </ThemedText>
                    <View style={styles.calloutMeta}>
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                        {property.bedrooms}bd {property.bathrooms}ba
                      </ThemedText>
                      {compatibility !== null ? (
                        <View style={[styles.miniMatchBadge, { backgroundColor: getMatchQualityColor(compatibility) + '20' }]}>
                          <ThemedText style={[Typography.caption, { color: getMatchQualityColor(compatibility), fontWeight: '700', fontSize: 11 }]}>
                            {compatibility}%
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    style={styles.calloutSave}
                    onPress={() => onToggleSave(property.id)}
                  >
                    <Feather name="heart" size={16} color={saved.has(property.id) ? '#EF4444' : theme.textSecondary} />
                  </Pressable>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
      <View style={[styles.propertyCount, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="map-pin" size={14} color={theme.primary} />
        <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.xs, fontWeight: '600' }]}>
          {propertiesWithCoords.length} {propertiesWithCoords.length === 1 ? 'property' : 'properties'}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  propertyCount: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callout: {
    width: 240,
    borderRadius: BorderRadius.medium,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutImage: {
    width: 240,
    height: 120,
    resizeMode: 'cover',
  },
  calloutInfo: {
    padding: Spacing.md,
  },
  calloutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  calloutSave: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMatchBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pinWrap: {
    alignItems: 'center',
  },
  pinPhotoRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pinPhotoRingSaved: {
    borderColor: '#EF4444',
  },
  pinPhoto: {
    width: 41,
    height: 41,
    borderRadius: 20,
  },
  pinPhotoFallback: {
    width: 41,
    height: 41,
    borderRadius: 20,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPhotoFallbackIcon: {
    fontSize: 18,
  },
  pinPricePill: {
    backgroundColor: '#ff6b5b',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    shadowColor: 'rgba(255,80,60,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  pinPricePillSaved: {
    backgroundColor: '#EF4444',
  },
  pinPriceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ff6b5b',
    marginTop: -1,
  },
  pinTipSaved: {
    borderTopColor: '#EF4444',
  },
  mapErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  mapErrorText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  mapErrorSubtext: {
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    fontSize: 13,
  },
  mapRetryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
