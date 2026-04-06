import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Feather } from './VectorIcons';

type Props = {
  audioUrl: string;
  durationMs: number;
  isOwnMessage: boolean;
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateBarHeights(url: string, count: number): number[] {
  const seed = hashCode(url);
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = ((seed * (i + 1) * 7 + i * 13) % 100) / 100;
    heights.push(0.2 + v * 0.8);
  }
  return heights;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const BAR_COUNT = 24;

export default function VoiceMessageBubble({ audioUrl, durationMs, isOwnMessage }: Props) {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);
  const barHeights = useRef(generateBarHeights(audioUrl, BAR_COUNT)).current;

  const isPlaying = status.playing;
  const positionMs = Math.round((status.currentTime ?? 0) * 1000);

  const togglePlay = useCallback(() => {
    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.error('Voice playback error:', err);
    }
  }, [isPlaying, player]);

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish]);

  const progressRatio = durationMs > 0 ? positionMs / durationMs : 0;
  const remaining = isPlaying ? Math.max(0, durationMs - positionMs) : durationMs;

  return (
    <View style={[localStyles.container, { backgroundColor: isOwnMessage ? 'rgba(255,107,91,0.15)' : 'rgba(255,255,255,0.06)' }]}>
      <Pressable onPress={togglePlay} style={[localStyles.playBtn, { backgroundColor: isOwnMessage ? '#ff6b5b' : 'rgba(255,255,255,0.12)' }]}>
        <Feather name={isPlaying ? 'pause' : 'play'} size={16} color="#FFF" />
      </Pressable>
      <View style={localStyles.waveContainer}>
        {barHeights.map((h, i) => {
          const active = i / BAR_COUNT <= progressRatio;
          return (
            <View
              key={i}
              style={[
                localStyles.bar,
                {
                  height: 4 + h * 20,
                  backgroundColor: active
                    ? (isOwnMessage ? '#ff6b5b' : '#fff')
                    : (isOwnMessage ? 'rgba(255,107,91,0.3)' : 'rgba(255,255,255,0.2)'),
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={localStyles.duration}>{formatTime(remaining)}</Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    minWidth: 200,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  duration: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },
});
