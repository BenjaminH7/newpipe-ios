import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VideoSummary } from '@/api/youtube';
import { useIsInMusicLibrary, useToggleMusicTrack } from '@/hooks/useMusicLibrary';
import { useIsVideoSaved, useToggleSavedVideo } from '@/hooks/useSavedVideos';
import { useTextOnlyMode } from '@/hooks/useSettings';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration, formatViews } from '@/utils/format';

export function VideoListItem({ video, onPress }: { video: VideoSummary; onPress: () => void }) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const saved = useIsVideoSaved(video.id);
  const toggleSaved = useToggleSavedVideo();
  const inMusic = useIsInMusicLibrary(video.id);
  const toggleMusic = useToggleMusicTrack();
  const progress = useWatchProgress(video.id);
  const [textOnlyMode] = useTextOnlyMode();
  const progressRatio = progress
    ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
    : 0;

  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.thumbnailWrap}>
        {textOnlyMode ? (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
        ) : (
          <Image source={{ uri: video.thumbnail }} style={[styles.thumbnail, sharedStyles.thumbnail]} contentFit="cover" />
        )}
        {video.duration >= 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        )}
        {progress && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        )}
        <Pressable
          onPress={() => toggleSaved(video)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveBadge,
            saved && { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color="#ffffff" />
        </Pressable>
        <Pressable
          onPress={() => toggleMusic(video)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.musicBadge,
            inMusic && { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={inMusic ? 'musical-notes' : 'musical-notes-outline'} size={16} color="#ffffff" />
        </Pressable>
      </View>
      <View style={styles.info}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {video.channelName}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {[formatViews(video.views), video.uploadedDate].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      marginBottom: 22,
    },
    pressed: {
      opacity: 0.7,
    },
    thumbnailWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 12,
      overflow: 'hidden',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    thumbnailPlaceholder: {
      backgroundColor: colors.surface,
    },
    durationBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.8)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
    },
    progressTrack: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
    },
    saveBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    musicBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durationText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
      fontVariant: ['tabular-nums'],
    },
    info: {
      marginTop: 10,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      marginBottom: 2,
    },
  });
}
