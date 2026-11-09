// Keep the native dependency out of the route's startup path in Expo Web and Expo Go.
export async function loadVideoCompressor() {
  const { Video } = await import('react-native-compressor');
  return Video;
}
