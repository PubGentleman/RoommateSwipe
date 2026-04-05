import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, Text, Linking } from 'react-native';
import { Image } from 'expo-image';
import { fetchLinkPreview } from '../utils/linkPreview';

type LinkPreviewData = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const previewCache: Record<string, LinkPreviewData | null> = {};

type Props = {
  url: string;
};

export default function LinkPreviewCard({ url }: Props) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(previewCache[url] || null);
  const [loaded, setLoaded] = useState(!!previewCache[url]);

  useEffect(() => {
    if (previewCache[url] !== undefined) {
      setPreview(previewCache[url]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetchLinkPreview(url).then(data => {
      if (cancelled) return;
      previewCache[url] = data;
      setPreview(data);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!loaded || !preview || (!preview.title && !preview.description)) return null;

  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  return (
    <Pressable onPress={() => Linking.openURL(url)} style={localStyles.card}>
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={localStyles.thumb} contentFit="cover" />
      ) : null}
      <View style={localStyles.textWrap}>
        {preview.title ? (
          <Text style={localStyles.title} numberOfLines={1}>{preview.title}</Text>
        ) : null}
        {preview.description ? (
          <Text style={localStyles.desc} numberOfLines={2}>{preview.description}</Text>
        ) : null}
        <Text style={localStyles.domain}>{preview.siteName || domain}</Text>
      </View>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
  },
  thumb: {
    width: 60,
    height: 60,
  },
  textWrap: {
    flex: 1,
    padding: 8,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  desc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  domain: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
  },
});
