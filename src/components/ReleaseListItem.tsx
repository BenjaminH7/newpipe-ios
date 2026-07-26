import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { ReleaseFeedItem } from '@/storage/releasesFeed';
import { useTheme, type ColorPalette } from '@/theme';

// Ligne du fil Nouveautés : pochette carrée, titre, artiste • type • date.
// `isNew` affiche un point accent — sorties pas encore vues au moment où
// l'écran s'est ouvert (l'écran marque tout vu en stockage dès l'ouverture).
export function ReleaseListItem({
  item,
  isNew,
  onPress,
}: {
  item: ReleaseFeedItem;
  isNew: boolean;
  onPress: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // YouTube Music ne donne qu'une année de sortie, pas une date pleine.
  const subtitle = [item.artistName, item.releaseDate].filter(Boolean).join(' • ');

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={[styles.cover, sharedStyles.coverSmall]} contentFit="cover" />
      ) : (
        <View style={[styles.cover, sharedStyles.coverSmall]} />
      )}
      <View style={styles.textBlock}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {isNew ? <View style={styles.newDot} /> : null}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    pressed: {
      opacity: 0.6,
    },
    cover: {
      width: 56,
      height: 56,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
    },
    newDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
  });
}
