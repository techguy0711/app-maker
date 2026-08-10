import { StyleSheet, View } from 'react-native';

import { CameraApp } from '@/components/camera-app';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <CameraApp />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
