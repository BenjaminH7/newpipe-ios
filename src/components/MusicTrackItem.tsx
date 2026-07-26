import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';

export function MusicTrackItem({
  track,
  onPress,
  onRemove,
  onRetryDownload,
}: {
  track: MusicTrack;
  onPress: () => void;
  onRemove: () => void;
  onRetryDownload: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
      <Image source={{ uri: track.coverArtUrl }} style={[styles.cover, sharedStyles.thumbnail]} contentFit="cover" />
      <View style={styles.info}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {[track.artist, track.duration >= 0 ? formatDuration(track.duration) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {track.downloadStatus === 'downloading' && (
        <ActivityIndicator color={colors.muted} style={styles.status} />
      )}
      {track.downloadStatus === 'failed' && (
        <Pressable hitSlop={8} onPress={onRetryDownload} style={styles.status}>
          <Ionicons name="refresh-circle-outline" size={22} color={colors.accent} />
        </Pressable>
      )}
      {track.downloadStatus === 'downloaded' && (
        <Ionicons name="checkmark-circle" size={18} color={colors.muted} style={styles.status} />
      )}

      <Pressable hitSlop={8} onPress={onRemove} style={styles.status}>
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: 52,
    height: 52,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    marginLeft: 4,
  },
});
