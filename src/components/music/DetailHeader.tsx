// En-tête des pages album et playlist : grande pochette centrée, titre,
// sous-titres, puis une rangée d'actions (enregistrer, radio, aléatoire,
// lecture) — la même disposition que les écrans AlbumScreen/PlaylistScreen de
// Metrolist.
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme, type ColorPalette } from '@/theme';

export function DetailHeader({
  thumbnail,
  title,
  subtitle,
  secondSubtitle,
  saved,
  onToggleSave,
  onPlay,
  onShuffle,
  onRadio,
  onSubtitlePress,
}: {
  thumbnail: string;
  title: string;
  subtitle?: string | null;
  secondSubtitle?: string | null;
  saved?: boolean;
  onToggleSave?: () => void;
  onPlay: () => void;
  onShuffle: () => void;
  onRadio?: () => void;
  onSubtitlePress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Ionicons name="musical-notes" size={56} color={colors.muted} />
        </View>
      )}

      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      {subtitle ? (
        <Pressable onPress={onSubtitlePress} disabled={!onSubtitlePress} hitSlop={6}>
          <Text style={[styles.subtitle, onSubtitlePress && styles.linkSubtitle]} numberOfLines={2}>
            {subtitle}
          </Text>
        </Pressable>
      ) : null}
      {secondSubtitle ? (
        <Text style={styles.secondSubtitle} numberOfLines={1}>
          {secondSubtitle}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {onToggleSave && (
          <Pressable hitSlop={10} onPress={onToggleSave} style={styles.iconButton}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? colors.accent : colors.text}
            />
          </Pressable>
        )}
        {onRadio && (
          <Pressable hitSlop={10} onPress={onRadio} style={styles.iconButton}>
            <Ionicons name="radio-outline" size={24} color={colors.text} />
          </Pressable>
        )}
        <View style={styles.spacer} />
        <Pressable hitSlop={10} onPress={onShuffle} style={styles.iconButton}>
          <Ionicons name="shuffle" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
        >
          <Ionicons name="play" size={26} color={colors.accentText} style={styles.playIcon} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    cover: {
      width: 224,
      height: 224,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.5,
      textAlign: 'center',
      marginTop: 18,
    },
    subtitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    linkSubtitle: {
      textDecorationLine: 'underline',
    },
    secondSubtitle: {
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 4,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 14,
      marginTop: 20,
      marginBottom: 8,
    },
    spacer: {
      flex: 1,
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
    playIcon: {
      marginLeft: 3,
    },
  });
}
