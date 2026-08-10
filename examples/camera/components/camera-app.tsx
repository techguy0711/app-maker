import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function CameraApp() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <ThemedView style={styles.fill} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.permissionContainer}>
          <ThemedText type="title" style={styles.permissionTitle}>
            Camera access needed
          </ThemedText>
          <ThemedText style={styles.permissionBody}>
            This app needs permission to use your camera to take photos.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow camera access"
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionButton, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="defaultSemiBold" style={styles.permissionButtonText}>
              Allow Camera Access
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function takePicture() {
    if (!cameraRef.current || !isReady) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo) {
      setPhotoUri(photo.uri);
    }
  }

  function retake() {
    setPhotoUri(null);
  }

  function toggleFacing() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  if (photoUri) {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: photoUri }} style={styles.fill} resizeMode="cover" />
        <SafeAreaView style={styles.previewControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
            onPress={retake}
            style={({ pressed }) => [styles.retakeButton, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="defaultSemiBold" style={styles.retakeButtonText}>
              Retake
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={cameraRef}
        style={styles.fill}
        facing={facing}
        onCameraReady={() => setIsReady(true)}
      />
      <SafeAreaView style={styles.controls} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          onPress={toggleFacing}
          style={({ pressed }) => [styles.flipButton, { opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText style={styles.flipButtonText}>Flip</ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          onPress={takePicture}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.captureButton,
            { opacity: pressed || !isReady ? 0.6 : 1 },
          ]}>
          <View style={styles.captureButtonInner} />
        </Pressable>

        <View style={styles.flipButtonSpacer} />
      </SafeAreaView>
    </View>
  );
}

const CAPTURE_SIZE = 76;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    textAlign: 'center',
  },
  permissionBody: {
    textAlign: 'center',
    opacity: 0.7,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#3c87f7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: '#ffffff',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: CAPTURE_SIZE - 16,
    height: CAPTURE_SIZE - 16,
    borderRadius: (CAPTURE_SIZE - 16) / 2,
    backgroundColor: '#ffffff',
  },
  flipButton: {
    width: 60,
    alignItems: 'center',
    paddingVertical: 10,
  },
  flipButtonSpacer: {
    width: 60,
  },
  flipButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
  },
  retakeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  retakeButtonText: {
    color: '#ffffff',
  },
});
