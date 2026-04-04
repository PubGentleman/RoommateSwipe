import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from './VectorIcons';

interface ChatImageMessageProps {
  url: string;
  isMine: boolean;
  timestamp: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MAX_WIDTH = SCREEN_WIDTH * 0.65;

const ChatImageMessage: React.FC<ChatImageMessageProps> = ({ url, isMine, timestamp }) => {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setFullscreen(true)}>
        <View style={[styles.container, isMine ? styles.mine : styles.theirs]}>
          <Image
            source={{ uri: url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          <Text style={styles.time}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Pressable>

      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fullscreenOverlay}>
          <Pressable style={styles.closeBtn} onPress={() => setFullscreen(false)}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
          <Image
            source={{ uri: url }}
            style={styles.fullscreenImage}
            contentFit="contain"
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', maxWidth: IMAGE_MAX_WIDTH },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  image: { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH * 0.75, borderRadius: 16 },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.4)', position: 'absolute', bottom: 6, right: 10 },
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  fullscreenImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 },
});

export default ChatImageMessage;
