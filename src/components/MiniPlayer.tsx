import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMusicQuotaExceeded } from '@/hooks/useUsageQuota';
import { usePlayer } from '@/player/PlayerContext';
import { colors, sharedStyles } from '@/theme';

/**
 * Barre "en cours de lecture" façon Spotify : rendue en dernier enfant de
 * chaque écran d'onglet (juste au-dessus de la tab bar par simple flexbox,
 * pas de calcul de hauteur/inset). Ne rend rien tant qu'aucune piste n'est
 * chargée.
 */
export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, isBuffering, togglePlay, playNext } = usePlayer();
  const musicQuotaExceeded = useMusicQuotaExceeded();

  if (!currentTrack || musicQuotaExceeded) return null;

  return (
    <Pressable style={styles.container} onPress={() => router.push('/music/player')}>
      <Image
        source={{ uri: currentTrack.coverArtUrl }}
        style={[styles.cover, sharedStyles.thumbnail]}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cover: {
    width: 40,
    height: 40,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
