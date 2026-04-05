import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, Animated, Platform, Image, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from './VectorIcons';
import { Property, User, RoommateProfile, AdvancedPropertyFilter } from '../types/models';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { calculateCompatibility, getMatchQualityColor } from '../utils/matchingAlgorithm';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  properties: Property[];
  savedPropertyIds: Set<string>;
  hostProfiles: Map<string, User>;
  currentUser: User | null;
  onPropertySelect: (property: Property) => void;
  onSaveToggle: (propertyId: string) => void;
  onRegionChange?: (region: { lat: number; lng: number; latDelta: number; lngDelta: number }) => void;
  activeFilters?: AdvancedPropertyFilter;
  initialCenter?: { lat: number; lng: number };
  bottomInset: number;
}

const formatPinPrice = (price: number): string => {
  if (price >= 1000) return `$${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
  return `$${price}`;
};

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

function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect = ((yi > point.longitude) !== (yj > point.longitude))
      && (point.latitude < (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildInteractiveLeafletHtml(
  markers: { id: string; lat: number; lng: number; price: number; title: string; beds: number; baths: number; photo: string; matchPct: number | null; matchColor: string; isSaved: boolean }[],
  center: { lat: number; lng: number },
  zoom: number,
  messageToken: string,
): string {
  const safeJson = JSON.stringify(markers).replace(/<\//g, '<\\/');
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const accentColor = '#ff6b5b';
  const purpleColor = '#6C5CE7';

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;background:#1a1a2e}
#loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.4);font-family:-apple-system,system-ui,sans-serif;font-size:13px}
.draw-banner{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(108,92,231,0.9);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-family:-apple-system,system-ui,sans-serif;font-weight:600;pointer-events:none;white-space:nowrap}
.draw-result{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:999;background:rgba(26,26,26,0.95);color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;gap:8px}
.draw-result button{background:none;border:none;color:${accentColor};font-weight:700;cursor:pointer;font-size:13px;font-family:-apple-system,system-ui,sans-serif}
.cluster-icon{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${purpleColor};color:#fff;font-weight:800;font-size:14px;font-family:-apple-system,system-ui,sans-serif;border:3px solid rgba(108,92,231,0.3);cursor:pointer;transition:transform 0.15s ease}
.cluster-icon:hover{transform:scale(1.1)}
</style>
</head><body>
<div id="map"><div id="loading">Loading map...</div></div>
<div id="drawBanner" class="draw-banner" style="display:none"></div>
<div id="drawResult" class="draw-result" style="display:none"></div>
<script>
var _msgToken='${messageToken}';
window.onerror=function(msg,url,line){
  var p=JSON.stringify({type:'mapError',message:msg,token:_msgToken});
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(p);
};
var _drawMode=false,_drawPoints=[],_drawPoly=null,_drawFilteredIds=null,_map=null,_allMarkerLayers=[],_drawDots=[];
function sendMsg(obj){
  obj.token=_msgToken;
  var s=JSON.stringify(obj);
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage(s,'*');
}
function loadCSS(u,cb){var l=document.createElement('link');l.rel='stylesheet';l.href=u;l.onload=cb;l.onerror=cb;document.head.appendChild(l)}
function loadJS(u,cb){var s=document.createElement('script');s.src=u;s.onload=cb;s.onerror=function(){
  var el=document.getElementById('loading');if(el)el.textContent='Map unavailable';
};document.head.appendChild(s)}
loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',function(){
  loadCSS('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',function(){
    loadCSS('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',function(){
      loadJS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',function(){
        loadJS('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',function(){
          initMap();
        });
      });
    });
  });
});
function initMap(){
  if(typeof L==='undefined')return;
  var el=document.getElementById('loading');if(el)el.remove();
  _map=L.map('map',{zoomControl:false}).setView([${center.lat},${center.lng}],${zoom});
  L.tileLayer('${tileUrl}',{attribution:'',maxZoom:19}).addTo(_map);
  L.control.zoom({position:'bottomright'}).addTo(_map);
  var markers=${safeJson};
  var clusterGroup=L.markerClusterGroup({
    maxClusterRadius:50,
    iconCreateFunction:function(cluster){
      var count=cluster.getChildCount();
      return L.divIcon({className:'',html:'<div class="cluster-icon">'+count+'</div>',iconSize:[40,40],iconAnchor:[20,20]});
    },
    spiderfyOnMaxZoom:true,
    showCoverageOnHover:false,
    zoomToBoundsOnClick:true
  });
  markers.forEach(function(m){
    var isS=m.isSaved;
    var icon=L.divIcon({
      className:'',
      html:'<div style="'
        +'display:inline-flex;align-items:center;justify-content:center;'
        +'background:#1a1a1a;color:#fff;'
        +'font-weight:700;font-size:12px;font-family:-apple-system,system-ui,sans-serif;'
        +'padding:6px 10px;border-radius:8px;white-space:nowrap;'
        +'box-shadow:0 2px 8px rgba(0,0,0,0.5);'
        +'border:1.5px solid rgba(255,255,255,0.1);'
        +'cursor:pointer;transition:all 0.15s ease;line-height:1;'
        +'" data-id="'+m.id+'">'
        +'$'+m.price.toLocaleString()
        +(isS?' <span style="color:#EF4444;margin-left:3px">&#9829;</span>':'')
        +'</div>',
      iconSize:[0,0],iconAnchor:[0,16]
    });
    var marker=L.marker([m.lat,m.lng],{icon:icon});
    marker._propertyId=m.id;
    marker.on('click',function(){
      if(window._activeChip){
        window._activeChip.style.background='#1a1a1a';
        window._activeChip.style.color='#fff';
        window._activeChip.style.borderColor='rgba(255,255,255,0.1)';
        window._activeChip.style.transform='scale(1)';
      }
      var chip=marker.getElement().querySelector('[data-id]');
      if(chip){
        chip.style.background='${accentColor}';
        chip.style.color='#fff';
        chip.style.borderColor='${accentColor}';
        chip.style.transform='scale(1.08)';
        window._activeChip=chip;
      }
      sendMsg({type:'markerSelect',id:m.id});
    });
    clusterGroup.addLayer(marker);
    _allMarkerLayers.push({marker:marker,id:m.id});
  });
  _map.addLayer(clusterGroup);
  window._clusterGroup=clusterGroup;
  if(markers.length>1){
    var bounds=L.latLngBounds(markers.map(function(m){return[m.lat,m.lng]}));
    _map.fitBounds(bounds,{padding:[40,40]});
  }
  _map.on('click',function(e){
    if(_drawMode){
      _drawPoints.push([e.latlng.lat,e.latlng.lng]);
      var dot=L.circleMarker(e.latlng,{radius:5,color:'${purpleColor}',fillColor:'${purpleColor}',fillOpacity:1,weight:0}).addTo(_map);
      _drawDots.push(dot);
      updateDrawPoly();
      updateDrawBanner();
      return;
    }
    if(window._activeChip){
      window._activeChip.style.background='#1a1a1a';
      window._activeChip.style.color='#fff';
      window._activeChip.style.borderColor='rgba(255,255,255,0.1)';
      window._activeChip.style.transform='scale(1)';
      window._activeChip=null;
    }
    sendMsg({type:'markerDeselect'});
  });
  _map.on('moveend',function(){
    var c=_map.getCenter();
    var b=_map.getBounds();
    sendMsg({type:'regionChange',lat:c.lat,lng:c.lng,latDelta:b.getNorth()-b.getSouth(),lngDelta:b.getEast()-b.getWest()});
  });
}
function updateDrawPoly(){
  if(_drawPoly)_map.removeLayer(_drawPoly);
  if(_drawPoints.length>=3){
    _drawPoly=L.polygon(_drawPoints,{color:'${purpleColor}',fillColor:'${purpleColor}',fillOpacity:0.12,weight:2}).addTo(_map);
  }
}
function updateDrawBanner(){
  var banner=document.getElementById('drawBanner');
  if(_drawMode){
    banner.style.display='block';
    banner.textContent='Tap to draw search area ('+_drawPoints.length+' points)';
  } else {
    banner.style.display='none';
  }
}
function clearDrawDots(){
  _drawDots.forEach(function(d){_map.removeLayer(d)});
  _drawDots=[];
}
function startDraw(){
  _drawMode=true;_drawPoints=[];
  clearDrawDots();
  if(_drawPoly){_map.removeLayer(_drawPoly);_drawPoly=null;}
  _drawFilteredIds=null;
  updateDrawBanner();
  document.getElementById('drawResult').style.display='none';
  showAllMarkers();
}
function completeDraw(){
  _drawMode=false;
  document.getElementById('drawBanner').style.display='none';
  if(_drawPoints.length<3){_drawPoints=[];return;}
  updateDrawPoly();
  var inside=[];
  _allMarkerLayers.forEach(function(ml){
    var ll=ml.marker.getLatLng();
    if(pointInPoly({lat:ll.lat,lng:ll.lng},_drawPoints)){
      inside.push(ml.id);
    }
  });
  _drawFilteredIds=new Set(inside);
  filterMarkersByDraw();
  var res=document.getElementById('drawResult');
  res.innerHTML=inside.length+' listing'+(inside.length!==1?'s':'')+' in area <button onclick="clearDraw()">Clear</button>';
  res.style.display='flex';
  sendMsg({type:'drawComplete',count:inside.length,ids:inside});
}
function clearDraw(){
  _drawMode=false;_drawPoints=[];_drawFilteredIds=null;
  clearDrawDots();
  if(_drawPoly){_map.removeLayer(_drawPoly);_drawPoly=null;}
  document.getElementById('drawBanner').style.display='none';
  document.getElementById('drawResult').style.display='none';
  showAllMarkers();
  sendMsg({type:'drawClear'});
}
function showAllMarkers(){
  _allMarkerLayers.forEach(function(ml){
    if(!window._clusterGroup.hasLayer(ml.marker)){
      window._clusterGroup.addLayer(ml.marker);
    }
  });
}
function filterMarkersByDraw(){
  _allMarkerLayers.forEach(function(ml){
    if(!_drawFilteredIds.has(ml.id)){
      window._clusterGroup.removeLayer(ml.marker);
    } else if(!window._clusterGroup.hasLayer(ml.marker)){
      window._clusterGroup.addLayer(ml.marker);
    }
  });
}
function pointInPoly(pt,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var xi=poly[i][0],yi=poly[i][1];
    var xj=poly[j][0],yj=poly[j][1];
    var intersect=((yi>pt.lng)!==(yj>pt.lng))&&(pt.lat<(xj-xi)*(pt.lng-yi)/(yj-yi)+xi);
    if(intersect)inside=!inside;
  }
  return inside;
}
function recenterTo(lat,lng){
  if(_map)_map.setView([lat,lng],15,{animate:true});
}
</script>
</body></html>`;
}

export default function InteractiveMapView({
  properties, savedPropertyIds, hostProfiles, currentUser,
  onPropertySelect, onSaveToggle, onRegionChange,
  activeFilters, initialCenter, bottomInset,
}: Props) {
  const { theme, isDark } = useTheme();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const [drawCount, setDrawCount] = useState<number | null>(null);
  const cardAnim = useRef(new Animated.Value(200)).current;
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const messageToken = useRef(`rhome_imap_${Date.now()}_${Math.random().toString(36).slice(2)}`).current;

  const propertiesWithCoords = useMemo(
    () => properties.filter(p => p.coordinates?.lat && p.coordinates?.lng),
    [properties]
  );

  const mapCenter = useMemo(() => {
    if (initialCenter) return initialCenter;
    if (propertiesWithCoords.length === 0) {
      const userCoords = currentUser?.profileData?.coordinates;
      if (userCoords) return { lat: userCoords.lat, lng: userCoords.lng };
      return { lat: 40.7128, lng: -74.006 };
    }
    const lats = propertiesWithCoords.map(p => p.coordinates!.lat);
    const lngs = propertiesWithCoords.map(p => p.coordinates!.lng);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [propertiesWithCoords, currentUser, initialCenter]);

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
        isSaved: savedPropertyIds.has(property.id),
      };
    });
  }, [propertiesWithCoords, hostProfiles, currentUser, savedPropertyIds]);

  const htmlContent = useMemo(
    () => buildInteractiveLeafletHtml(mapMarkers, mapCenter, 12, messageToken),
    [mapMarkers, mapCenter, messageToken]
  );

  const showPreviewCard = useCallback((id: string | null) => {
    if (id) {
      setSelectedPropertyId(id);
      Animated.spring(cardAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(cardAnim, { toValue: 200, duration: 200, useNativeDriver: true }).start(() => {
        setSelectedPropertyId(null);
      });
    }
  }, [cardAnim]);

  const handleMessage = useCallback((rawData: string) => {
    try {
      const data = JSON.parse(rawData);
      if (data.token !== messageToken) return;
      if (data.type === 'markerSelect') {
        showPreviewCard(data.id);
      } else if (data.type === 'markerDeselect') {
        showPreviewCard(null);
      } else if (data.type === 'regionChange') {
        onRegionChange?.({ lat: data.lat, lng: data.lng, latDelta: data.latDelta, lngDelta: data.lngDelta });
      } else if (data.type === 'drawComplete') {
        setDrawActive(false);
        setDrawCount(data.count);
      } else if (data.type === 'drawClear') {
        setDrawActive(false);
        setDrawCount(null);
      } else if (data.type === 'mapError') {
        console.error('[InteractiveMapView] JS error:', data.message);
        setMapError(true);
      }
    } catch {}
  }, [showPreviewCard, onRegionChange, messageToken]);

  const injectJS = useCallback((js: string) => {
    if (Platform.OS === 'web') return;
    webViewRef.current?.injectJavaScript(js + ';true;');
  }, []);

  const callIframeFunction = useCallback((fnName: string, ...args: any[]) => {
    if (Platform.OS === 'web') {
      const win = iframeRef.current?.contentWindow as any;
      if (win?.[fnName]) win[fnName](...args);
    } else {
      const argsStr = args.map(a => JSON.stringify(a)).join(',');
      injectJS(`${fnName}(${argsStr})`);
    }
  }, [injectJS]);

  const handleLocateMe = useCallback(async () => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      callIframeFunction('recenterTo', loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      console.warn('[InteractiveMapView] Location error:', err);
    }
  }, [callIframeFunction]);

  const handleDrawToggle = useCallback(() => {
    if (drawActive) {
      callIframeFunction('completeDraw');
      setDrawActive(false);
    } else {
      callIframeFunction('startDraw');
      setDrawActive(true);
      setDrawCount(null);
    }
  }, [drawActive, callIframeFunction]);

  const handleClearDraw = useCallback(() => {
    callIframeFunction('clearDraw');
    setDrawActive(false);
    setDrawCount(null);
  }, [callIframeFunction]);

  const selectedProperty = selectedPropertyId
    ? propertiesWithCoords.find(p => p.id === selectedPropertyId) ?? null
    : null;

  const selectedMarkerData = selectedPropertyId
    ? mapMarkers.find(m => m.id === selectedPropertyId) ?? null
    : null;

  const previewCard = selectedProperty && selectedMarkerData ? (
    <Animated.View style={[styles.previewCard, { transform: [{ translateY: cardAnim }], bottom: 16 + bottomInset }]}>
      <Pressable
        style={styles.previewCardInner}
        onPress={() => onPropertySelect(selectedProperty)}
      >
        {selectedProperty.photos[0] ? (
          <Image
            source={{ uri: selectedProperty.photos[0] }}
            style={styles.previewImage}
          />
        ) : (
          <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
            <Feather name="image" size={24} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <View style={styles.previewInfo}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewPrice}>
              ${selectedProperty.price.toLocaleString()}/mo
            </Text>
            <Pressable
              onPress={() => onSaveToggle(selectedProperty.id)}
              hitSlop={8}
            >
              <Feather
                name="heart"
                size={20}
                color={savedPropertyIds.has(selectedProperty.id) ? '#EF4444' : 'rgba(255,255,255,0.3)'}
              />
            </Pressable>
          </View>
          <Text style={styles.previewTitle} numberOfLines={1}>{selectedProperty.title}</Text>
          <Text style={styles.previewLocation} numberOfLines={1}>
            {selectedProperty.neighborhood || selectedProperty.city}
          </Text>
          <View style={styles.previewDetails}>
            <Text style={styles.previewDetail}>{selectedProperty.bedrooms} BR</Text>
            <Text style={styles.previewDot}>{'\u00B7'}</Text>
            <Text style={styles.previewDetail}>{selectedProperty.bathrooms} BA</Text>
            {selectedMarkerData.matchPct !== null ? (
              <>
                <Text style={styles.previewDot}>{'\u00B7'}</Text>
                <View style={[styles.matchBadge, { backgroundColor: selectedMarkerData.matchColor + '20' }]}>
                  <Text style={[styles.matchBadgeText, { color: selectedMarkerData.matchColor }]}>
                    {selectedMarkerData.matchPct}% Match
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  ) : null;

  const controlButtons = (
    <View style={[styles.controls, { bottom: (selectedProperty ? 200 : 24) + bottomInset }]}>
      <Pressable style={styles.controlBtn} onPress={handleLocateMe}>
        <Feather name="crosshair" size={20} color="#fff" />
      </Pressable>
      <Pressable
        style={[styles.controlBtn, drawActive && styles.controlBtnActive]}
        onPress={handleDrawToggle}
      >
        <Feather name="edit-2" size={20} color={drawActive ? '#fff' : '#fff'} />
      </Pressable>
      {(drawActive || drawCount !== null) ? (
        <Pressable style={styles.controlBtn} onPress={handleClearDraw}>
          <Feather name="x" size={20} color="#ef4444" />
        </Pressable>
      ) : null}
    </View>
  );

  const countBadge = (
    <View style={styles.countBadge}>
      <Feather name="map-pin" size={14} color="#ff6b5b" />
      <Text style={styles.countBadgeText}>
        {drawCount !== null ? `${drawCount} in area` : `${propertiesWithCoords.length} listings`}
      </Text>
    </View>
  );

  if (mapError) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Feather name="map" size={40} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Map couldn't load</Text>
        <Text style={styles.errorSubtext}>Check your internet connection</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setMapError(false); setMapLoaded(false); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (event: MessageEvent) => {
      if (typeof event.data === 'string') handleMessage(event.data);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleMessage]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          ref={iframeRef as any}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
        />
        {countBadge}
        {controlButtons}
        {previewCard}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!mapLoaded ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator color="#ff6b5b" size="large" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
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
          console.warn('[InteractiveMapView] WebView error:', syntheticEvent.nativeEvent.description);
          setMapError(true);
        }}
        onMessage={(event: { nativeEvent: { data: string } }) => {
          handleMessage(event.nativeEvent.data);
        }}
      />
      {countBadge}
      {controlButtons}
      {previewCard}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0d0d0d',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 13,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  errorSubtext: {
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    fontSize: 13,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(26,26,26,0.92)',
    gap: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    right: 16,
    gap: 10,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26,26,26,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlBtnActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  previewCardInner: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  previewImage: {
    width: 110,
    height: 110,
    resizeMode: 'cover',
  },
  previewImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
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
    color: '#fff',
  },
  previewTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  previewLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  previewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  previewDetail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  previewDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  matchBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
