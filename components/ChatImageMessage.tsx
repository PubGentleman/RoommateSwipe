import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface ImageItem {
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

interface ChatImageMessageProps {
  url?: string;
  images?: ImageItem[];
  isMine: boolean;
  timestamp: string;
  onOpenGallery?: (index: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MAX_WIDTH = SCREEN_WIDTH * 0.65;
const GAP = 2;

const ChatImageMessage: React.FC<ChatImageMessageProps> = ({ url, images, isMine, timestamp, onOpenGallery }) => {
  const imageList: ImageItem[] = images || (url ? [{ url }] : []);
  const count = imageList.length;

  if (count === 0) return null;

  const handlePress = (index: number) => {
    if (onOpenGallery) {
      onOpenGallery(index);
    }
  };

  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (count === 1) {
    const img = imageList[0];
    const displayUrl = img.thumbnailUrl || img.url;
    return (
      <Pressable onPress={() => handlePress(0)}>
        <View style={[styles.container, isMine ? styles.mine : styles.theirs, isMine ? styles.borderOwn : styles.borderOther]}>
          <Image source={{ uri: displayUrl }} style={styles.singleImage} contentFit="cover" transition={200} />
          <Text style={styles.time}>{timeStr}</Text>
        </View>
      </Pressable>
    );
  }

  if (count === 2) {
    const halfW = (IMAGE_MAX_WIDTH - GAP) / 2;
    return (
      <View style={[styles.container, isMine ? styles.mine : styles.theirs, isMine ? styles.borderOwn : styles.borderOther]}>
        <View style={styles.gridRow}>
          {imageList.map((img, i) => (
            <Pressable key={i} onPress={() => handlePress(i)}>
              <Image source={{ uri: img.thumbnailUrl || img.url }} style={{ width: halfW, height: halfW, borderRadius: i === 0 ? 16 : 16 }} contentFit="cover" />
            </Pressable>
          ))}
        </View>
        <Text style={styles.time}>{timeStr}</Text>
      </View>
    );
  }

  if (count === 3) {
    const leftW = IMAGE_MAX_WIDTH * 0.55;
    const rightW = IMAGE_MAX_WIDTH - leftW - GAP;
    const rightH = (IMAGE_MAX_WIDTH * 0.75 - GAP) / 2;
    return (
      <View style={[styles.container, isMine ? styles.mine : styles.theirs, isMine ? styles.borderOwn : styles.borderOther]}>
        <View style={styles.gridRow}>
          <Pressable onPress={() => handlePress(0)}>
            <Image source={{ uri: imageList[0].thumbnailUrl || imageList[0].url }} style={{ width: leftW, height: IMAGE_MAX_WIDTH * 0.75, borderRadius: 16 }} contentFit="cover" />
          </Pressable>
          <View style={{ gap: GAP }}>
            {[1, 2].map(i => (
              <Pressable key={i} onPress={() => handlePress(i)}>
                <Image source={{ uri: imageList[i].thumbnailUrl || imageList[i].url }} style={{ width: rightW, height: rightH, borderRadius: 16 }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.time}>{timeStr}</Text>
      </View>
    );
  }

  const cellW = (IMAGE_MAX_WIDTH - GAP) / 2;
  const cellH = cellW * 0.85;
  const displayImages = imageList.slice(0, 4);
  const extraCount = count - 4;

  return (
    <View style={[styles.container, isMine ? styles.mine : styles.theirs, isMine ? styles.borderOwn : styles.borderOther]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, width: IMAGE_MAX_WIDTH }}>
        {displayImages.map((img, i) => (
          <Pressable key={i} onPress={() => handlePress(i)}>
            <View>
              <Image source={{ uri: img.thumbnailUrl || img.url }} style={{ width: cellW, height: cellH, borderRadius: 16 }} contentFit="cover" />
              {i === 3 && extraCount > 0 ? (
                <View style={styles.extraOverlay}>
                  <Text style={styles.extraText}>+{extraCount}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.time}>{timeStr}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: IMAGE_MAX_WIDTH,
  },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  borderOwn: { borderWidth: 1, borderColor: 'rgba(255,107,91,0.3)' },
  borderOther: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  singleImage: {
    width: IMAGE_MAX_WIDTH,
    height: IMAGE_MAX_WIDTH * 0.75,
    borderRadius: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  time: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    position: 'absolute',
    bottom: 6,
    right: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  extraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ChatImageMessage;
