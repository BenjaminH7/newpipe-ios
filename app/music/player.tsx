import { useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/player/PlayerContext';
import { colors, sharedStyles } from '@/theme';
import { formatDuration } from '@/utils/format';

export default function MusicPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    shuffle,
    repeat,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();
  const [trackWidth, setTrackWidth] = useState(0);

  if (!currentTrack) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <Text style={sharedStyles.mutedText}>Aucune piste en cours de lecture.</Text>
      </View>
    );
  }

  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const handleSeek = (e: GestureResponderEvent) => {
    if (trackWidth === 0 || duration <= 0) return;
    const x = e.nativeEvent.locationX;
    const nextRatio = Math.min(1, Math.max(0, x / trackWidth));
    seekTo(nextRatio * duration);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
        <Ionicons name="chevron-down" size={28} color={colors.text} />
      </Pressable>

      <Image
        source={{ uri: currentTrack.coverArtUrl }}
        style={[styles.cover, sharedStyles.thumbnail]}
        contentFit="cover"
      />

      <View style={styles.meta}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={2}>
          {currentTrack.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>

      <Pressable
        style={styles.progressTrack}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        onPress={handleSeek}
      >
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={sharedStyles.mutedText}>{formatDuration(position)}</Text>
        <Text style={sharedStyles.mutedText}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.controlsRow}>
        <Pressable hitSlop={12} onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={22} color={shuffle ? colors.accent : colors.muted} />
        </Pressable>
        <Pressable hitSlop={12} onPress={playPrevious}>
          <Ionicons name="play-skip-back" size={30} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={12} onPress={togglePlay} style={styles.playButton}>
          {isBuffering ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color={colors.accentText} />
          )}
        </Pressable>
        <Pressable hitSlop={12} onPress={playNext}>
          <Ionicons name="play-skip-forward" size={30} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={12} onPress={cycleRepeat} style={styles.repeatButton}>
          <Ionicons name="repeat" size={22} color={repeat === 'off' ? colors.muted : colors.accent} />
          {repeat === 'one' && <Text style={styles.repeatOneBadge}>1</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  empty: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  closeButton: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    alignSelf: 'center',
  },
  meta: {
    marginTop: 28,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
    marginTop: 28,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatButton: {
    width: 22,
    height: 22,
  },
  repeatOneBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
  },
});
