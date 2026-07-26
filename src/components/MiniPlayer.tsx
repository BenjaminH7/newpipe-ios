import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicQuotaExceeded } from '@/hooks/useUsageQuota';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

/**
 * Barre "en cours de lecture" façon Spotify : carte flottante arrondie posée
 * en absolu au-dessus de la tab bar translucide (le contenu défile dessous),
 * avec un fin liseré de progression en bas. Ne rend rien tant qu'aucune piste
 * n'est chargée.
 */
export function MiniPlayer() {
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currentTrack, isPlaying, isBuffering, position, duration, togglePlay, playNext } =
    usePlayer();
  const musicQuotaExceeded = useMusicQuotaExceeded();
  const { miniPlayerBottom } = useBottomOffsets();

  if (!currentTrack || musicQuotaExceeded) return null;

  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, { bottom: miniPlayerBottom }, pressed && styles.pressed]}
      onPress={() => router.push('/music/player')}
    >
      <Image
        source={{ uri: currentTrack.coverArtUrl }}
        style={[styles.cover, sharedStyles.coverSmall]}
        contentFit="cover"
      />
      <View style={styles.info}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>

      {isBuffering ? (
        <ActivityIndicator color={colors.accent} style={styles.button} />
      ) : (
        <Pressable hitSlop={8} onPress={togglePlay} style={styles.button}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
        </Pressable>
      )}
      <Pressable hitSlop={8} onPress={playNext} style={styles.button}>
        <Ionicons name="play-skip-forward" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    pressed: {
      opacity: 0.9,
    },
    cover: {
      width: 42,
      height: 42,
    },
    info: {
      flex: 1,
      gap: 1,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
    },
    button: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 2,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    // Liseré de progression dans la couleur du texte (blanc en sombre),
    // comme le mini-player de Spotify — l'accent est réservé aux actions.
    progressFill: {
      height: '100%',
      backgroundColor: colors.text,
    },
  });
}
