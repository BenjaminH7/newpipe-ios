// Playlist créée dans l'app, présentée façon Spotify : grande pochette (ou
// mosaïque) sur un fond teinté par les pochettes, barre du haut qui se remplit
// au défilement, rangée d'actions, puis les titres. Ajout de titres depuis la
// bibliothèque, réordonnancement, renommage et suppression — l'équivalent
// local du LocalPlaylistScreen de Metrolist.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MiniPlayer } from '@/components/MiniPlayer';
import { AddTracksSheet } from '@/components/music/AddTracksSheet';
import { BottomSheet, SheetRow } from '@/components/music/BottomSheet';
import { PlaylistCover } from '@/components/music/PlaylistCover';
import { LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useLocalPlaylist } from '@/hooks/useMusicCollections';
import { usePlayer } from '@/player/PlayerContext';
import {
  deleteLocalPlaylist,
  moveTrackInLocalPlaylist,
  removeTrackFromLocalPlaylist,
  renameLocalPlaylist,
} from '@/storage/musicCollections';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration, formatTotalDuration } from '@/utils/format';

// Hauteur de défilement à partir de laquelle le titre migre de la pochette
// vers la barre du haut.
const TITLE_SWAP_OFFSET = 170;

export default function LocalPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    playTrackRadio,
    enqueueNext,
    enqueueLast,
    toggleShuffle,
    shuffle,
  } = usePlayer();
  const { playlist, loading } = useLocalPlaylist(id ?? null);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [reordering, setReordering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuTrack, setMenuTrack] = useState<MusicTrack | null>(null);

  // Barre du haut : transparente au-dessus de la pochette, opaque ensuite.
  const [scrolled, setScrolled] = useState(false);
  const barOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barOpacity, {
      toValue: scrolled ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [scrolled, barOpacity]);

  // useMemo (et non `?? []`) pour que la liste vide garde son identité entre
  // deux rendus : sinon tous les callbacks qui en dépendent se recréent.
  const tracks = useMemo(() => playlist?.tracks ?? [], [playlist]);
  const totalDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + Math.max(0, t.duration), 0),
    [tracks],
  );

  const playAll = useCallback(() => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  }, [tracks, playTrack]);

  const shuffleAll = useCallback(() => {
    if (tracks.length === 0) return;
    if (!shuffle) toggleShuffle();
    playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks);
  }, [tracks, playTrack, shuffle, toggleShuffle]);

  const confirmDelete = useCallback(() => {
    if (!playlist) return;
    Alert.alert('Supprimer la playlist ?', `« ${playlist.name} » sera supprimée définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteLocalPlaylist(playlist.id);
          router.back();
        },
      },
    ]);
  }, [playlist, router]);

  const commitRename = useCallback(() => {
    if (!playlist) return;
    renameLocalPlaylist(playlist.id, name);
    setRenaming(false);
  }, [playlist, name]);

  const startRename = useCallback(() => {
    if (!playlist) return;
    setName(playlist.name);
    setRenaming(true);
  }, [playlist]);

  if (!playlist) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false, title: 'Playlist' }} />
        <Pressable
          hitSlop={8}
          onPress={() => router.back()}
          style={[styles.backButton, { top: insets.top + 8 }]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        {loading ? (
          <LoadingView />
        ) : (
          <View style={styles.emptyScreen}>
            <Text style={styles.emptyTitle}>Cette playlist n’existe plus.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { height: insets.top + 52, paddingTop: insets.top }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.topBarFill, { opacity: barOpacity }]}
        />
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.topBarButton}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Animated.Text numberOfLines={1} style={[styles.topBarTitle, { opacity: barOpacity }]}>
          {playlist.name}
        </Animated.Text>
        <Pressable
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={styles.topBarButton}
          accessibilityLabel="Options de la playlist"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > TITLE_SWAP_OFFSET)}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { paddingTop: insets.top + 64 }]}>
              {/* Fond teinté par la pochette, comme le dégradé Spotify. */}
              {tracks[0]?.coverArtUrl ? (
                <Image
                  source={{ uri: tracks[0].coverArtUrl }}
                  style={styles.heroBackdrop}
                  contentFit="cover"
                  blurRadius={60}
                />
              ) : null}
              <LinearGradient
                colors={['transparent', colors.background]}
                locations={[0.15, 0.92]}
                style={styles.heroScrim}
                pointerEvents="none"
              />
              <View style={styles.coverShadow}>
                <PlaylistCover tracks={tracks} size={200} radius={6} />
              </View>

              {renaming ? (
                <View style={styles.renameRow}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.renameInput}
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={commitRename}
                    onBlur={commitRename}
                  />
                  <Pressable hitSlop={8} onPress={commitRename} accessibilityLabel="Valider le nom">
                    <Ionicons name="checkmark-circle" size={30} color={colors.accent} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onLongPress={startRename} delayLongPress={300}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {playlist.name}
                  </Text>
                </Pressable>
              )}
              <Text style={styles.heroMeta}>
                Playlist • {tracks.length} titre{tracks.length > 1 ? 's' : ''}
                {totalDuration > 0 ? ` • ${formatTotalDuration(totalDuration)}` : ''}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.addLabel}>Ajouter des titres</Text>
              </Pressable>
              <View style={styles.spacer} />
              {tracks.length > 0 && (
                <>
                  <Pressable hitSlop={10} onPress={shuffleAll} style={styles.iconButton}>
                    <Ionicons
                      name="shuffle"
                      size={26}
                      color={shuffle ? colors.accent : colors.text}
                    />
                  </Pressable>
                  <Pressable
                    onPress={playAll}
                    accessibilityLabel="Lire la playlist"
                    style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name="play"
                      size={26}
                      color={colors.accentText}
                      style={styles.playIcon}
                    />
                  </Pressable>
                </>
              )}
            </View>

            {reordering && tracks.length > 0 && (
              <View style={styles.reorderBar}>
                <Text style={styles.reorderHint}>Réordonne les titres avec les flèches</Text>
                <Pressable hitSlop={8} onPress={() => setReordering(false)}>
                  <Text style={styles.reorderDone}>Terminé</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyScreen}>
            <Text style={styles.emptyTitle}>Playlist vide</Text>
            <Text style={styles.emptyMessage}>
              Ajoute des titres de ta bibliothèque, ou utilise « Ajouter à une playlist » depuis le
              menu d’un titre.
            </Text>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            >
              <Text style={styles.emptyButtonLabel}>Ajouter des titres</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => {
          const isActive = currentTrack?.id === item.id;
          const isFirst = index === 0;
          const isLast = index === tracks.length - 1;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => playTrack(item, tracks)}
            >
              <View>
                <Image
                  source={{ uri: item.coverArtUrl }}
                  style={[styles.cover, sharedStyles.coverSmall]}
                  contentFit="cover"
                />
                {/* Même repère de lecture que SongRow et la file d'attente :
                    un voile sur la pochette plutôt qu'un préfixe textuel. */}
                {isActive && (
                  <View style={styles.coverOverlay}>
                    <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={18} color="#ffffff" />
                  </View>
                )}
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowTitle, isActive && { color: colors.accent }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.artist}
                  {item.duration >= 0 ? ` • ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>

              {reordering ? (
                <>
                  <Pressable
                    hitSlop={6}
                    disabled={isFirst}
                    accessibilityLabel={`Monter ${item.title}`}
                    onPress={() => moveTrackInLocalPlaylist(playlist.id, item.id, -1)}
                    style={styles.rowButton}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={20}
                      color={isFirst ? colors.border : colors.muted}
                    />
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    disabled={isLast}
                    accessibilityLabel={`Descendre ${item.title}`}
                    onPress={() => moveTrackInLocalPlaylist(playlist.id, item.id, 1)}
                    style={styles.rowButton}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={isLast ? colors.border : colors.muted}
                    />
                  </Pressable>
                  <Pressable
                    hitSlop={6}
                    accessibilityLabel={`Retirer ${item.title} de la playlist`}
                    onPress={() => removeTrackFromLocalPlaylist(playlist.id, item.id)}
                    style={styles.rowButton}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color={colors.muted} />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={`Options de ${item.title}`}
                  onPress={() => setMenuTrack(item)}
                  style={styles.rowButton}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />

      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={playlist.name}
        subtitle={`${tracks.length} titre${tracks.length > 1 ? 's' : ''}`}
      >
        <View style={styles.sheetBody}>
          <SheetRow
            icon="add-circle-outline"
            label="Ajouter des titres"
            detail="Depuis ta bibliothèque"
            onPress={() => {
              setMenuOpen(false);
              setAddOpen(true);
            }}
          />
          <SheetRow
            icon="create-outline"
            label="Renommer la playlist"
            onPress={() => {
              setMenuOpen(false);
              startRename();
            }}
          />
          {tracks.length > 1 && (
            <SheetRow
              icon="swap-vertical"
              label={reordering ? 'Terminer la réorganisation' : 'Modifier l’ordre'}
              highlighted={reordering}
              onPress={() => {
                setReordering((prev) => !prev);
                setMenuOpen(false);
              }}
            />
          )}
          {tracks.length > 0 && (
            <SheetRow
              icon="radio-outline"
              label="Lancer la radio"
              onPress={() => {
                setMenuOpen(false);
                playTrackRadio(tracks[0]);
              }}
            />
          )}
          <SheetRow
            icon="trash-outline"
            label="Supprimer la playlist"
            destructive
            onPress={() => {
              setMenuOpen(false);
              confirmDelete();
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={menuTrack !== null}
        onClose={() => setMenuTrack(null)}
        title={menuTrack?.title}
        subtitle={menuTrack?.artist}
      >
        <View style={styles.sheetBody}>
          <SheetRow
            icon="play-forward"
            label="Lire ensuite"
            onPress={() => {
              if (menuTrack) enqueueNext(menuTrack);
              setMenuTrack(null);
            }}
          />
          <SheetRow
            icon="albums-outline"
            label="Ajouter à la file"
            onPress={() => {
              if (menuTrack) enqueueLast(menuTrack);
              setMenuTrack(null);
            }}
          />
          <SheetRow
            icon="person-outline"
            label="Voir l’artiste"
            detail={menuTrack?.artist}
            onPress={() => {
              const artist = menuTrack?.artist;
              setMenuTrack(null);
              if (artist) router.push({ pathname: '/music/artist', params: { artist } });
            }}
          />
          <SheetRow
            icon="remove-circle-outline"
            label="Retirer de la playlist"
            destructive
            onPress={() => {
              if (menuTrack) removeTrackFromLocalPlaylist(playlist.id, menuTrack.id);
              setMenuTrack(null);
            }}
          />
        </View>
      </BottomSheet>

      <AddTracksSheet
        playlistId={addOpen ? playlist.id : null}
        existingIds={tracks.map((t) => t.id)}
        onClose={() => setAddOpen(false)}
        onAdded={(count) => {
          if (count === 0) Alert.alert('Ces titres sont déjà dans la playlist.');
        }}
      />

      <MiniPlayer />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pressed: {
      opacity: 0.7,
    },
    backButton: {
      position: 'absolute',
      left: 12,
      zIndex: 20,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      gap: 6,
    },
    topBarFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topBarButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    list: {
      flexGrow: 1,
    },
    hero: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    heroBackdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.55,
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
    },
    coverShadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.6,
      textAlign: 'center',
      marginTop: 20,
    },
    heroMeta: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
    renameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      alignSelf: 'stretch',
      marginTop: 18,
    },
    renameInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingLeft: 12,
      paddingRight: 16,
      paddingVertical: 9,
    },
    addLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
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
    playIcon: {
      marginLeft: 3,
    },
    reorderBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 20,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    reorderHint: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    reorderDone: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    cover: {
      width: 50,
      height: 50,
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
    rowButton: {
      width: 30,
      alignItems: 'center',
    },
    sheetBody: {
      paddingTop: 6,
    },
    emptyScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
      paddingVertical: 40,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    emptyMessage: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyButton: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      marginTop: 8,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    emptyButtonLabel: {
      color: colors.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
