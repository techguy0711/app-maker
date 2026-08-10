import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CHART_TYPES } from '@/constants/storefronts';
import { useThemeColor } from '@/hooks/use-theme-color';
import { artworkUrl, fetchTrackDetails, type ChartKind, type TrackDetails } from '@/lib/appleMusic';

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function DetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    kind: ChartKind;
    storefront: string;
    name: string;
    artistName: string;
    artworkUrl100: string;
    url: string;
    releaseDate: string;
    genre: string;
  }>();

  const accent = useThemeColor({}, 'accent');
  const secondaryText = useThemeColor({}, 'secondaryText');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  const [details, setDetails] = useState<TrackDetails | null>(null);
  const [detailsError, setDetailsError] = useState(false);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const chartTypeLabel = CHART_TYPES.find((t) => t.kind === params.kind)?.singular ?? 'Item';

  useEffect(() => {
    let cancelled = false;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    fetchTrackDetails(params.id, params.storefront)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch(() => {
        if (!cancelled) setDetailsError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.storefront]);

  useEffect(() => {
    if (details?.previewUrl) {
      player.replace({ uri: details.previewUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details?.previewUrl]);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime >= status.duration && status.duration > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const openInAppleMusic = () => {
    Linking.openURL(params.url).catch(() => {});
  };

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: chartTypeLabel, headerBackTitle: 'Charts' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Image
          source={{ uri: artworkUrl(params.artworkUrl100, 600) }}
          style={styles.artwork}
          contentFit="cover"
        />

        <ThemedText type="title" style={styles.title}>
          {params.name}
        </ThemedText>
        {params.artistName ? (
          <ThemedText style={[styles.artist, { color: secondaryText }]}>{params.artistName}</ThemedText>
        ) : null}

        <View style={styles.metaRow}>
          {params.genre ? <ThemedText style={[styles.metaText, { color: secondaryText }]}>{params.genre}</ThemedText> : null}
          {params.genre && params.releaseDate ? (
            <ThemedText style={[styles.metaText, { color: secondaryText }]}>·</ThemedText>
          ) : null}
          {params.releaseDate ? (
            <ThemedText style={[styles.metaText, { color: secondaryText }]}>
              {formatDate(params.releaseDate)}
            </ThemedText>
          ) : null}
        </View>

        {details?.previewUrl ? (
          <View style={[styles.previewCard, { backgroundColor: card, borderColor: border }]}>
            <Pressable onPress={togglePlayback} style={[styles.playButton, { backgroundColor: accent }]}>
              <Ionicons name={status.playing ? 'pause' : 'play'} size={22} color="#fff" style={!status.playing ? styles.playIconOffset : undefined} />
            </Pressable>
            <View style={styles.previewInfo}>
              <ThemedText style={styles.previewLabel}>Preview</ThemedText>
              <View style={[styles.progressTrack, { backgroundColor: border }]}>
                <View style={[styles.progressFill, { backgroundColor: accent, width: `${Math.min(progress, 1) * 100}%` }]} />
              </View>
            </View>
            <ThemedText style={[styles.durationText, { color: secondaryText }]}>
              {formatDuration(status.duration * 1000 || details.trackTimeMillis)}
            </ThemedText>
          </View>
        ) : !detailsError ? null : null}

        <Pressable onPress={openInAppleMusic} style={[styles.openButton, { backgroundColor: accent }]}>
          <Ionicons name="musical-notes" size={18} color="#fff" />
          <ThemedText style={styles.openButtonText}>Open in Apple Music</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 6 },
  artwork: {
    width: 260,
    height: 260,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: { fontSize: 24, textAlign: 'center' },
  artist: { fontSize: 17, textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 20 },
  metaText: { fontSize: 14 },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 16,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconOffset: { marginLeft: 2 },
  previewInfo: { flex: 1, gap: 6 },
  previewLabel: { fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  durationText: { fontSize: 12, minWidth: 36, textAlign: 'right' },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    minHeight: 50,
    borderRadius: 25,
    marginTop: 8,
  },
  openButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
