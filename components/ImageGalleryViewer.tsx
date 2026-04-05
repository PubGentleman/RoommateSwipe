import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GalleryImage {
  url: string;
  senderName?: string;
  createdAt?: string;
}

interface Props {
  visible: boolean;
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageGalleryViewer({ visible, images, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setLoadedImages(new Set());
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const currentImage = images[currentIndex];
  const formattedDate = currentImage?.createdAt
    ? new Date(currentImage.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar hidden />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
          {images.length > 1 ? (
            <Text style={styles.counter}>
              {currentIndex + 1} of {images.length}
            </Text>
          ) : null}
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <View style={styles.imageContainer}>
              {!loadedImages.has(index) ? <ActivityIndicator size="large" color="#ff6b5b" style={styles.loader} /> : null}
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                contentFit="contain"
                onLoad={() => handleImageLoad(index)}
              />
            </View>
          )}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          {currentImage?.senderName ? (
            <Text style={styles.senderName}>{currentImage.senderName}</Text>
          ) : null}
          {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  loader: {
    position: 'absolute',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
  },
  senderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
});
