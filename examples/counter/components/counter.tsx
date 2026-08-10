import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const BUTTON_BACKGROUND = { light: '#F0F0F3', dark: '#212225' };
const ACCENT = '#3c87f7';

export function Counter() {
  const scheme = useColorScheme() ?? 'light';
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.count}>{count}</ThemedText>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease"
          onPress={() => setCount((c) => c - 1)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: BUTTON_BACKGROUND[scheme], opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText style={styles.buttonText}>−</ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase"
          onPress={() => setCount((c) => c + 1)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: BUTTON_BACKGROUND[scheme], opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText style={[styles.buttonText, { color: ACCENT }]}>+</ThemedText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset to zero"
        onPress={() => setCount(0)}
        style={({ pressed }) => [
          styles.resetButton,
          { backgroundColor: BUTTON_BACKGROUND[scheme], opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText type="defaultSemiBold">Reset</ThemedText>
      </Pressable>
    </View>
  );
}

const BUTTON_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 40,
  },
  count: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 84,
    minWidth: 160,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 24,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  resetButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
});
