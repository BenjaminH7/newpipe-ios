// Rangée de titre du catalogue YouTube Music (recherche, album, playlist,
// titres populaires d'un artiste), équivalente au SongListItem de Metrolist :
// pochette, titre + badge explicite, artistes, durée, bouton menu.
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { artistNames } from '@/api/ytmusic/convert';
import type { YTSong } from '@/api/ytmusic/types';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';
import { ExplicitBadge } from './ExplicitBadge';

export const SongRow = memo(function SongRow({
  song,
  /** Numéro de piste affiché à la place de la pochette (albums). */
  index,
  isActive = false,
  isPlaying = false,
  onPress,
  onMenu,
}: {
  song: YTSong;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
  onMenu?: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const subtitle = artistNames(song.artists);

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {index !== undefined ? (
        <View style={styles.indexBox}>
          {isActive ? (
            <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={16} color={colors.accent} />
          ) : (
            <Text style={styles.indexText}>{index}</Text>
          )}
        </View>
      ) : (
        <View>
          <Image
            source={{ uri: song.thumbnail }}
            style={[styles.cover, sharedStyles.coverSmall]}
            contentFit="cover"
          />
          {isActive && (
            <View style={styles.coverOverlay}>
              <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={18} color="#ffffff" />
            </View>
          )}
        </View>
      )}

      <View style={styles.info}>
        <Text
          style={[styles.title, isActive && { color: colors.accent }]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <View style={styles.subRow}>
          {song.explicit && <ExplicitBadge />}
          <Text style={[sharedStyles.mutedText, styles.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      {song.duration >= 0 && <Text style={styles.duration}>{formatDuration(song.duration)}</Text>}
      {onMenu && (
        <Pressable hitSlop={8} onPress={onMenu} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
});

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    pressed: {
      opacity: 0.6,
    },
    cover: {
      width: 48,
      height: 48,
    },
    coverOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 4,
    },
    indexBox: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    indexText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
    },
    info: {
      flex: 1,
      gap: 3,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    subtitle: {
      flexShrink: 1,
    },
    duration: {
      color: colors.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    menuButton: {
      width: 28,
      alignItems: 'center',
    },
  });
}
