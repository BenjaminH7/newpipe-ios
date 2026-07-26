import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';

export function MusicTrackItem({
  track,
  isActive = false,
  isPlaying = false,
  onPress,
  onArtistPress,
  onRemove,
  onRetryDownload,
}: {
  track: MusicTrack;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
  onArtistPress: () => void;
  onRemove: () => void;
  onRetryDownload: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
      <Image source={{ uri: track.coverArtUrl }} style={[styles.cover, sharedStyles.thumbnail]} contentFit="cover" />
      <View style={styles.info}>
        <View style={styles.titleRow}>
          {isActive && (
            <Ionicons
              name={isPlaying ? 'volume-high' : 'pause'}
              size={14}
              color={colors.accent}
              style={styles.playingIcon}
            />
          )}
          <Text
            style={[sharedStyles.text, styles.title, isActive && { color: colors.accent }]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
        </View>
        <View style={styles.subRow}>
          <Pressable hitSlop={6} onPress={onArtistPress} style={styles.artistPressable}>
            <Text style={[sharedStyles.mutedText, styles.artistLink]} numberOfLines={1}>
              {track.artist}
            </Text>
          </Pressable>
          {track.duration >= 0 && (
            <Text style={sharedStyles.mutedText} numberOfLines={1}>
              {' '}
              · {formatDuration(track.duration)}
            </Text>
          )}
        </View>
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
        <Ionicons name="heart-outline" size={20} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: 56,
    height: 56,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playingIcon: {
    marginRight: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistPressable: {
    flexShrink: 1,
  },
  artistLink: {
    fontWeight: '600',
  },
  status: {
    marginLeft: 4,
  },
});
