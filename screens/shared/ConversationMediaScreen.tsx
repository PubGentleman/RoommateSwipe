import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, ActivityIndicator, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '../../components/VectorIcons';
import { getConversationMedia } from '../../services/chatAttachmentService';
import { ImageGalleryViewer } from '../../components/ImageGalleryViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface MediaItem {
  url: string;
  thumbnailUrl?: string;
  messageId: string;
  createdAt: string;
}

export default function ConversationMediaScreen({ route, navigation }: any) {
  const { matchId, title } = route.params;
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    loadMedia();
  }, [matchId]);

  const loadMedia = async () => {
    try {
      const items = await getConversationMedia(matchId);
      setMedia(items);
    } catch (e) {
      console.error('Failed to load conversation media:', e);
    } finally {
      setLoading(false);
    }
  };

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const galleryImages = media.map(m => ({ url: m.url, createdAt: m.createdAt }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>{title || 'Shared Media'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ff6b5b" style={{ marginTop: 40 }} />
      ) : media.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="image" size={48} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No shared media yet</Text>
          <Text style={styles.emptySubtext}>Photos shared in this conversation will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item, i) => `${item.messageId}-${i}`}
          contentContainerStyle={{ padding: GAP }}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => openGallery(index)} style={{ margin: GAP / 2 }}>
              <Image
                source={{ uri: item.thumbnailUrl || item.url }}
                style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 4 }}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          )}
        />
      )}

      <ImageGalleryViewer
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    maxWidth: 260,
  },
});
