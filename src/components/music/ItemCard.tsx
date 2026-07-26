// Carte d'un élément du catalogue dans un carrousel ou une grille : pochette
// carrée (album/playlist/titre) ou ronde (artiste), titre, sous-titre —
// équivalent des YouTubeGridItem / YouTubeCardItem de Metrolist.
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { artistNames } from '@/api/ytmusic/convert';
import type { YTItem } from '@/api/ytmusic/types';
import { useTheme, type ColorPalette } from '@/theme';
import { ExplicitBadge } from './ExplicitBadge';

export const CARD_WIDTH = 148;

export function itemSubtitle(item: YTItem): string {
  switch (item.type) {
    case 'song':
      return artistNames(item.artists);
    case 'album':
      return [artistNames(item.artists), item.year].filter(Boolean).join(' • ');
    case 'artist':
      return item.subtitle ?? 'Artiste';
    case 'playlist':
      return item.subtitle ?? item.author ?? 'Playlist';
  }
}

export const ItemCard = memo(function ItemCard({
  item,
  onPress,
  width = CARD_WIDTH,
}: {
  item: YTItem;
  onPress: () => void;
  width?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const round = item.type === 'artist';
  const title = item.type === 'artist' ? item.name : item.title;
  const subtitle = itemSubtitle(item);
  const explicit = (item.type === 'song' || item.type === 'album') && item.explicit;

  return (
    <Pressable style={({ pressed }) => [{ width }, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.coverWrap, { width, height: width }, round && { borderRadius: width / 2 }]}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons
              name={round ? 'person' : item.type === 'playlist' ? 'list' : 'musical-notes'}
              size={32}
              color={colors.muted}
            />
          </View>
        )}
      </View>
      <Text
        style={[styles.title, round && styles.centered]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <View style={[styles.subRow, round && styles.centeredRow]}>
          {explicit && <ExplicitBadge />}
          <Text style={[styles.subtitle, round && styles.centered]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    coverWrap: {
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    cover: {
      width: '100%',
      height: '100%',
    },
    coverFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 8,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    centeredRow: {
      justifyContent: 'center',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 12,
      flexShrink: 1,
    },
    centered: {
      textAlign: 'center',
    },
  });
}
