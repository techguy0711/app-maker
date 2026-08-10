import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChartListItem } from '@/components/chart-list-item';
import { ChartTypeSwitcher } from '@/components/chart-type-switcher';
import { CountryPicker } from '@/components/country-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_STOREFRONT, type Storefront } from '@/constants/storefronts';
import { useThemeColor } from '@/hooks/use-theme-color';
import { fetchChart, type ChartItem, type ChartKind } from '@/lib/appleMusic';

export default function HomeScreen() {
  const [kind, setKind] = useState<ChartKind>('songs');
  const [storefront, setStorefront] = useState<Storefront>(DEFAULT_STOREFRONT);
  const [items, setItems] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = useThemeColor({}, 'accent');

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const results = await fetchChart(storefront.code, kind, 50);
        setItems(results);
      } catch {
        setError("Couldn't load the chart. Check your connection and try again.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [storefront, kind]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront, kind]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Charts
          </ThemedText>
          <CountryPicker value={storefront} onChange={setStorefront} />
        </View>
        <View style={styles.switcherWrap}>
          <ChartTypeSwitcher value={kind} onChange={setKind} />
        </View>

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={accent} />
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable onPress={() => load()} hitSlop={8}>
              <ThemedText style={[styles.retry, { color: accent }]}>Try again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ChartListItem
                item={item}
                rank={index + 1}
                onPress={() =>
                  router.push({
                    pathname: '/detail',
                    params: {
                      id: item.id,
                      kind: item.kind,
                      storefront: storefront.code,
                      name: item.name,
                      artistName: item.artistName ?? '',
                      artworkUrl100: item.artworkUrl100,
                      url: item.url,
                      releaseDate: item.releaseDate ?? '',
                      genre: item.genres[0]?.name ?? '',
                    },
                  })
                }
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={accent} />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 32 },
  switcherWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  listContent: { paddingBottom: 24 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { textAlign: 'center' },
  retry: { fontSize: 15, fontWeight: '600', minHeight: 44, textAlignVertical: 'center' },
});
