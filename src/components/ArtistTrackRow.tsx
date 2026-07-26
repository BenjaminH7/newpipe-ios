import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { DeezerTrack } from '@/api/deezer';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';

export function ArtistTrackRow({
  rank,
  track,
  isResolving,
  isActive,
  isPlaying,
  onPress,
}: {
  rank: number;
  track: DeezerTrack;
  isResolving: boolean;
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.rankBox}>
        {isResolving ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : isActive ? (
          <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={16} color={colors.accent} />
        ) : (
          <Text style={sharedStyles.mutedText}>{rank}</Text>
        )}
      </View>
      <Image source={{ uri: track.albumCoverUrl }} style={[styles.cover, sharedStyles.coverSmall]} contentFit="cover" />
      <Text style={[sharedStyles.text, styles.title, isActive && { color: colors.accent }]} numberOfLines={1}>
        {track.title}
      </Text>
      {track.duration >= 0 && (
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {formatDuration(track.duration)}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    pressed: {
      opacity: 0.6,
    },
    rankBox: {
      width: 24,
      alignItems: 'center',
    },
    cover: {
      width: 44,
      height: 44,
    },
    // Titre en graisse moyenne, comme les listes de titres Spotify — le gras
    // est réservé aux titres de section et aux noms.
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
  });
}
