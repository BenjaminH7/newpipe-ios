import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { DeezerAlbum } from '@/api/deezer';
import { useTheme, type ColorPalette } from '@/theme';

const CARD_WIDTH = 130;

export const RECORD_TYPE_LABELS: Record<string, string> = {
  album: 'Album',
  single: 'Single',
  ep: 'EP',
  compile: 'Compilation',
};

export function AlbumCard({ album, onPress }: { album: DeezerAlbum; onPress: () => void }) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const year = album.releaseDate ? album.releaseDate.slice(0, 4) : '';
  const typeLabel = RECORD_TYPE_LABELS[album.recordType] ?? '';
  const subtitle = [year, typeLabel].filter(Boolean).join(' • ');

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      {album.coverUrl ? (
        <Image source={{ uri: album.coverUrl }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <Text style={[sharedStyles.text, styles.title]} numberOfLines={2}>
        {album.title}
      </Text>
      {subtitle ? (
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      width: CARD_WIDTH,
    },
    pressed: {
      opacity: 0.6,
    },
    cover: {
      width: CARD_WIDTH,
      height: CARD_WIDTH,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    coverPlaceholder: {
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 8,
    },
  });
}
