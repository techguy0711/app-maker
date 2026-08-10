import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { artworkUrl, type ChartItem } from '@/lib/appleMusic';

interface Props {
  item: ChartItem;
  rank: number;
  onPress: () => void;
}

export function ChartListItem({ item, rank, onPress }: Props) {
  const secondaryText = useThemeColor({}, 'secondaryText');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: border, opacity: pressed ? 0.6 : 1 }]}
    >
      <ThemedText style={[styles.rank, { color: secondaryText }]}>{rank}</ThemedText>
      <Image source={{ uri: artworkUrl(item.artworkUrl100, 120) }} style={styles.artwork} contentFit="cover" />
      <View style={styles.textBlock}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {item.name}
        </ThemedText>
        {item.artistName ? (
          <ThemedText style={[styles.subtitle, { color: secondaryText }]} numberOfLines={1}>
            {item.artistName}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: {
    width: 24,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13 },
});
