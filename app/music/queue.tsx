// File d'attente, équivalent de l'écran « File d'attente » de Spotify : la
// piste en cours en haut, la suite en dessous. Sans cet écran, « Lire ensuite »
// et « Ajouter à la file » du menu d'un titre agissaient à l'aveugle — rien
// dans l'app ne montrait ni ne laissait corriger la file.
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { EmptyView } from '@/components/StatusView';
import type { MusicTrack } from '@/storage/musicLibrary';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';

export default function QueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    currentTrack,
    queue,
    isPlaying,
    shuffle,
    repeat,
    radioEnabled,
    playFromQueue,
    removeFromQueue,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  // « À suivre » = ce qui reste après la piste en cours. Hors de la file (piste
  // lancée seule), on n'affiche que l'en-tête.
  const upcoming = useMemo(() => {
    const index = queue.findIndex((t) => t.id === currentTrack?.id);
    return index === -1 ? [] : queue.slice(index + 1);
  }, [queue, currentTrack?.id]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.headerSide}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>File d’attente</Text>
        <View style={styles.headerSide} />
      </View>

      <FlatList
        data={upcoming}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          currentTrack ? (
            <View>
              <Text style={styles.sectionLabel}>En cours de lecture</Text>
              <QueueRow track={currentTrack} active isPlaying={isPlaying} />
              {upcoming.length > 0 && (
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
                  {radioEnabled ? 'À suivre — radio' : 'À suivre'}
                </Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          currentTrack ? (
            <EmptyView
              icon="list-outline"
              title="Rien après ce titre"
              message="Utilise « Lire ensuite » ou « Ajouter à la file » dans le menu d’un titre pour préparer la suite."
            />
          ) : (
            <EmptyView
              icon="musical-notes-outline"
              title="Aucune lecture en cours"
              message="Lance un titre pour construire ta file d’attente."
            />
          )
        }
        renderItem={({ item }) => (
          <QueueRow
            track={item}
            onPress={() => playFromQueue(item)}
            onRemove={() => removeFromQueue(item.id)}
          />
        )}
      />

      {/* Aléatoire et répétition en pied d'écran, là où Spotify les place dans
          sa vue file d'attente. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable hitSlop={10} onPress={toggleShuffle} style={styles.footerButton}>
          <Ionicons name="shuffle" size={22} color={shuffle ? colors.accent : colors.muted} />
          <Text style={[styles.footerLabel, shuffle && { color: colors.accent }]}>Aléatoire</Text>
        </Pressable>
        <Pressable hitSlop={10} onPress={cycleRepeat} style={styles.footerButton}>
          <Ionicons name="repeat" size={22} color={repeat === 'off' ? colors.muted : colors.accent} />
          <Text style={[styles.footerLabel, repeat !== 'off' && { color: colors.accent }]}>
            {repeat === 'one' ? 'Répéter ce titre' : 'Répéter'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function QueueRow({
  track,
  active = false,
  isPlaying = false,
  onPress,
  onRemove,
}: {
  track: MusicTrack;
  active?: boolean;
  isPlaying?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View>
        <Image
          source={{ uri: track.coverArtUrl }}
          style={[styles.cover, sharedStyles.coverSmall]}
          contentFit="cover"
        />
        {active && (
          <View style={styles.coverOverlay}>
            <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={18} color="#ffffff" />
          </View>
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, active && { color: colors.accent }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      {track.duration > 0 && <Text style={styles.duration}>{formatDuration(track.duration)}</Text>}
      {onRemove && (
        <Pressable
          hitSlop={10}
          onPress={onRemove}
          accessibilityLabel={`Retirer ${track.title} de la file`}
          style={styles.removeButton}
        >
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pressed: {
      opacity: 0.6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    headerSide: {
      width: 40,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 20,
    },
    sectionLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    sectionLabelSpaced: {
      marginTop: 22,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
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
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    duration: {
      color: colors.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    removeButton: {
      width: 28,
      alignItems: 'center',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    footerButton: {
      alignItems: 'center',
      gap: 4,
    },
    footerLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
