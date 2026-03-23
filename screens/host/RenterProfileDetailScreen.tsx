import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentRenter } from '../../services/agentMatchmakerService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';

export const RenterProfileDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const renter: AgentRenter = route.params?.renter;

  if (!renter) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Renter not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Renter Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}>
        {renter.photos?.[0] ? (
          <Image source={{ uri: renter.photos[0] }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.placeholder]}>
            <Feather name="user" size={48} color="#555" />
          </View>
        )}

        <Text style={styles.name}>{renter.name}, {renter.age}</Text>
        <Text style={styles.occupation}>{renter.occupation}</Text>

        {renter.bio ? <Text style={styles.bio}>{renter.bio}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget & Move-in</Text>
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={16} color={GREEN} />
            <Text style={styles.detailText}>
              {renter.budgetMin && renter.budgetMax
                ? `$${renter.budgetMin.toLocaleString()} - $${renter.budgetMax.toLocaleString()}/mo`
                : 'Not specified'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={16} color="#888" />
            <Text style={styles.detailText}>
              {renter.moveInDate
                ? `Move-in: ${new Date(renter.moveInDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                : 'Flexible move-in'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="home" size={16} color="#888" />
            <Text style={styles.detailText}>
              Looking for: {renter.roomType === 'entire_apartment' ? 'Entire apartment' : renter.roomType === 'room' ? 'Room' : 'Either'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
          <View style={styles.tagRow}>
            {renter.cleanliness != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Cleanliness: {renter.cleanliness}/10</Text>
              </View>
            ) : null}
            {renter.sleepSchedule ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.sleepSchedule}</Text>
              </View>
            ) : null}
            {renter.smoking != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.smoking ? 'Smoker' : 'Non-smoker'}</Text>
              </View>
            ) : null}
            {renter.pets != null ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{renter.pets ? 'Has pets' : 'No pets'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {renter.interests && renter.interests.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.tagRow}>
              {renter.interests.map((interest, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
                  <Text style={[styles.tagText, { color: ACCENT }]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {renter.neighborhood ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color="#888" />
              <Text style={styles.detailText}>{renter.neighborhood}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroImage: { width: '100%', height: 300, borderRadius: 16, marginBottom: 16 },
  placeholder: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
  occupation: { color: '#999', fontSize: 15, marginTop: 4 },
  bio: { color: '#ccc', fontSize: 14, lineHeight: 22, marginTop: 12 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailText: { color: '#ccc', fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: '#aaa', fontSize: 12 },
  errorText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 40 },
});
