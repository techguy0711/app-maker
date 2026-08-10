import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { STOREFRONTS, type Storefront } from '@/constants/storefronts';
import { useThemeColor } from '@/hooks/use-theme-color';

interface Props {
  value: Storefront;
  onChange: (storefront: Storefront) => void;
}

export function CountryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');
  const background = useThemeColor({}, 'background');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: card, borderColor: border }]}
      >
        <ThemedText style={styles.flag}>{value.flag}</ThemedText>
        <ThemedText style={styles.code}>{value.code.toUpperCase()}</ThemedText>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: background, borderColor: border }]}>
          <ThemedText type="subtitle" style={styles.sheetTitle}>
            Country
          </ThemedText>
          <FlatList
            data={STOREFRONTS}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const selected = item.code === value.code;
              return (
                <Pressable
                  style={[styles.row, { borderBottomColor: border }]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <ThemedText style={styles.rowFlag}>{item.flag}</ThemedText>
                  <ThemedText style={styles.rowName}>{item.name}</ThemedText>
                  {selected ? <ThemedText style={{ color: accent, fontWeight: '700' }}>✓</ThemedText> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 18 },
  code: { fontSize: 14, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetTitle: { textAlign: 'center', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowFlag: { fontSize: 22 },
  rowName: { flex: 1, fontSize: 16 },
});
