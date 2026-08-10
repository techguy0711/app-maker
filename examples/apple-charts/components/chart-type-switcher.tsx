import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CHART_TYPES } from '@/constants/storefronts';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { ChartKind } from '@/lib/appleMusic';

interface Props {
  value: ChartKind;
  onChange: (kind: ChartKind) => void;
}

export function ChartTypeSwitcher({ value, onChange }: Props) {
  const card = useThemeColor({}, 'card');
  const background = useThemeColor({}, 'background');
  const accent = useThemeColor({}, 'accent');
  const secondaryText = useThemeColor({}, 'secondaryText');

  return (
    <View style={[styles.track, { backgroundColor: card }]}>
      {CHART_TYPES.map((option) => {
        const selected = option.kind === value;
        return (
          <Pressable
            key={option.kind}
            onPress={() => onChange(option.kind)}
            style={[styles.segment, selected && { backgroundColor: background }]}
          >
            <ThemedText
              style={[styles.label, { color: selected ? accent : secondaryText }]}
              numberOfLines={1}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
});
