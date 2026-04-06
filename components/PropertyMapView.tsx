import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
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

  const chipBg = isDark ? '#1a1a1a' : '#fff';
  const chipColor = isDark ? '#fff' : '#111';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;background:${isDark ? '#1a1a2e' : '#f0f0f0'}}
#loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:${isDark ? 'rgba(255,255,255,0.4)' : '#999'};font-family:-apple-system,system-ui,sans-serif;font-size:13px}
</style>
</head><body>
<div id="map"><div id="loading">Loading map...</div></div>
<script>
window.onerror = function(msg, url, line) {
  var payload = JSON.stringify({type:'mapError', message: msg, url: url, line: line});
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  }
};
function loadCSS(url,cb){var l=document.createElement('link');l.rel='stylesheet';l.href=url;l.onload=cb;l.onerror=cb;document.head.appendChild(l)}
function loadJS(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;s.onerror=function(){
  var el=document.getElementById('loading');if(el)el.textContent='Map unavailable';
  var payload = JSON.stringify({type:'mapError', message:'Failed to load Leaflet JS from CDN'});
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(payload)}
};document.head.appendChild(s)}
loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',function(){
  loadJS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',function(){
    if(typeof L==='undefined')return;
    var el=document.getElementById('loading');if(el)el.remove();
    var map=L.map('map',{zoomControl:false}).setView([${center.lat},${center.lng}],${zoom});
    L.tileLayer('${tileUrl}',{attribution:'',maxZoom:19}).addTo(map);
    L.control.zoom({position:'bottomright'}).addTo(map);
    var markers=${markersJson};
    markers.forEach(function(m){
      var isS = m.isSaved;
      var icon = L.divIcon({
        className: '',
        html: '<div style="'
          + 'display:inline-flex;align-items:center;justify-content:center;'
          + 'background:${chipBg};'
          + 'color:${chipColor};'
          + 'font-weight:700;font-size:12px;font-family:-apple-system,system-ui,sans-serif;'
          + 'padding:6px 10px;border-radius:8px;white-space:nowrap;'
          + 'box-shadow:0 2px 8px rgba(0,0,0,0.35);'
          + 'border:1.5px solid ${chipBorder};'
          + 'cursor:pointer;transition:all 0.15s ease;'
          + 'line-height:1;'
          + '"'
          + ' data-id="' + m.id + '"'
          + '>$' + m.price.toLocaleString()
          + (isS ? ' <span style="color:#EF4444;margin-left:2px">&#9829;</span>' : '')
          + '</div>',
        iconSize: [0, 0],
        iconAnchor: [0, 16]
      });
      var marker = L.marker([m.lat, m.lng], {icon: icon}).addTo(map);
      marker.on('click', function() {
        if (window._activeChip) {
          window._activeChip.style.background = '${chipBg}';
          window._activeChip.style.color = '${chipColor}';
          window._activeChip.style.borderColor = '${chipBorder}';
          window._activeChip.style.transform = 'scale(1)';
        }
        var chip = marker.getElement().querySelector('[data-id]');
        if (chip) {
          chip.style.background = '#ff6b5b';
          chip.style.color = '#fff';
          chip.style.borderColor = '#ff6b5b';
          chip.style.transform = 'scale(1.08)';
          window._activeChip = chip;
        }
        var msg = JSON.stringify({
          type: 'markerSelect',
          id: m.id,
          token: '__MSG_TOKEN__'
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(msg);
        } else {
          window.parent.postMessage(msg, '*');
        }
      });
    });

    map.on('click', function() {
      if (window._activeChip) {
        window._activeChip.style.background = '${chipBg}';
        window._activeChip.style.color = '${chipColor}';
        window._activeChip.style.borderColor = '${chipBorder}';
        window._activeChip.style.transform = 'scale(1)';
        window._activeChip = null;
      }
      var msg = JSON.stringify({ type: 'markerDeselect', token: '__MSG_TOKEN__' });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    });

    if(markers.length>1){
      var bounds=L.latLngBounds(markers.map(function(m){return[m.lat,m.lng]}));
      map.fitBounds(bounds,{padding:[40,40]});
    }
  });
});
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

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

  const htmlContent = buildLeafletHtml(
    mapMarkers,
    { lat: initialRegion.latitude, lng: initialRegion.longitude },
    12,
    isDark
  );

  const messageToken = React.useRef(`rhome_map_${Date.now()}_${Math.random().toString(36).slice(2)}`).current;
  const htmlWithToken = htmlContent.replace(/__MSG_TOKEN__/g, messageToken);

  const handlePropertyTap = useCallback((id: string) => {
    const property = properties.find(p => p.id === id);
    if (property) onPropertyPress(property);
  }, [properties, onPropertyPress]);

  const handleMessage = useCallback((rawData: string) => {
    try {
      const data = JSON.parse(rawData);
      if (data.token !== messageToken) return;
      if (data.type === 'markerSelect') {
        setSelectedPropertyId(data.id);
      } else if (data.type === 'markerDeselect') {
        setSelectedPropertyId(null);
      } else if (data.type === 'propertyTap') {
        handlePropertyTap(data.id);
      } else if (data.type === 'mapError') {
        console.error('[PropertyMapView] JS error in map:', data.message);
        setMapError(true);
      }
    } catch {}
  }, [messageToken, handlePropertyTap]);

  const selectedProperty = selectedPropertyId
    ? propertiesWithCoords.find(p => p.id === selectedPropertyId) ?? null
    : null;

  const selectedMarkerData = selectedPropertyId
    ? mapMarkers.find(m => m.id === selectedPropertyId) ?? null
    : null;

  const previewCard = selectedProperty && selectedMarkerData ? (
    <Pressable
      style={[styles.previewCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
      onPress={() => onPropertyPress(selectedProperty)}
    >
      <Image
        source={{ uri: selectedProperty.photos[0] }}
        style={styles.previewImage}
        resizeMode="cover"
      />
      <View style={styles.previewInfo}>
        <View style={styles.previewHeader}>
          <Text style={[styles.previewPrice, { color: isDark ? '#fff' : '#111' }]}>
            ${selectedProperty.price.toLocaleString()}/mo
          </Text>
          <Pressable
            onPress={() => onToggleSave(selectedProperty.id)}
            hitSlop={8}
          >
            <Feather
              name="heart"
              size={20}
              color={saved.has(selectedProperty.id) ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.3)' : '#ccc')}
            />
          </Pressable>
        </View>
        <Text style={[styles.previewMeta, { color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }]} numberOfLines={1}>
          {selectedProperty.bedrooms}bd {selectedProperty.bathrooms}ba · {selectedProperty.title}
        </Text>
        {selectedMarkerData.matchPct !== null ? (
          <View style={styles.previewMatchRow}>
            <View style={[styles.previewMatchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0' }]}>
              <View style={[styles.previewMatchFill, { width: `${selectedMarkerData.matchPct}%`, backgroundColor: selectedMarkerData.matchColor }]} />
            </View>
            <Text style={[styles.previewMatchText, { color: selectedMarkerData.matchColor }]}>
              {selectedMarkerData.matchPct}% Match
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  ) : null;

  if (Platform.OS === 'web') {
    React.useEffect(() => {
      const onMsg = (event: MessageEvent) => {
        handleMessage(event.data);
      };
      window.addEventListener('message', onMsg);
      return () => window.removeEventListener('message', onMsg);
    }, [handleMessage]);

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
        {previewCard}
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={[styles.mapContainer, styles.mapErrorContainer, { paddingBottom: bottomInset }]}>
        <Feather name="map" size={40} color="rgba(255,255,255,0.2)" />
        <Text style={styles.mapErrorText}>Map couldn't load</Text>
        <Text style={styles.mapErrorSubtext}>Check your internet connection</Text>
        <Pressable style={styles.mapRetryBtn} onPress={() => { setMapError(false); setMapLoaded(false); }}>
          <Text style={styles.mapRetryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.mapContainer, { paddingBottom: bottomInset }]}>
      {!mapLoaded ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }]}>
          <ActivityIndicator color="#ff6b5b" size="large" />
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 13 }}>Loading map...</Text>
        </View>
      ) : null}
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlWithToken }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled={false}
        onLoad={() => setMapLoaded(true)}
        onError={(syntheticEvent: { nativeEvent: { description?: string } }) => {
          console.warn('[PropertyMapView] WebView error:', syntheticEvent.nativeEvent.description);
          setMapError(true);
        }}
        onHttpError={(syntheticEvent: { nativeEvent: { statusCode?: number } }) => {
          console.warn('[PropertyMapView] HTTP error:', syntheticEvent.nativeEvent.statusCode);
        }}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          handleMessage(event.nativeEvent.data);
        }}
      />
      <View style={[styles.propertyCount, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="map-pin" size={14} color={theme.primary} />
        <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.xs, fontWeight: '600' }]}>
          {propertiesWithCoords.length} {propertiesWithCoords.length === 1 ? 'property' : 'properties'}
        </ThemedText>
      </View>
      {previewCard}
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
  previewCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  previewImage: {
    width: 100,
    height: 100,
  },
  previewInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewPrice: {
    fontSize: 18,
    fontWeight: '800',
  },
  previewMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  previewMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  previewMatchBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  previewMatchFill: {
    height: '100%',
    borderRadius: 2,
  },
  previewMatchText: {
    fontSize: 11,
    fontWeight: '700',
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
