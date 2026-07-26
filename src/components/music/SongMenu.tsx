// Menu contextuel d'un titre, façon YouTube Music / Metrolist : feuille qui
// remonte du bas avec les actions de file (« Lire ensuite », « Ajouter à la
// file »), la radio, la bibliothèque, les playlists locales et les raccourcis
// vers l'album et l'artiste. Exposé par un provider pour que n'importe quel
// écran puisse l'ouvrir avec showSongMenu(song).
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { artistNames, songToTrack } from '@/api/ytmusic/convert';
import type { YTSong } from '@/api/ytmusic/types';
import { useLocalPlaylists } from '@/hooks/useMusicCollections';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { useIsInMusicLibrary, useToggleTrackInLibrary } from '@/hooks/useMusicLibrary';
import { usePlayer } from '@/player/PlayerContext';
import { addTrackToLocalPlaylist, createLocalPlaylist } from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SongMenuContextValue {
  showSongMenu: (song: YTSong) => void;
}

const SongMenuContext = createContext<SongMenuContextValue | null>(null);

export function SongMenuProvider({ children }: { children: ReactNode }) {
  const [song, setSong] = useState<YTSong | null>(null);
  const showSongMenu = useCallback((next: YTSong) => setSong(next), []);
  const value = useMemo(() => ({ showSongMenu }), [showSongMenu]);

  return (
    <SongMenuContext.Provider value={value}>
      {children}
      <SongMenuSheet song={song} onClose={() => setSong(null)} />
    </SongMenuContext.Provider>
  );
}

export function useSongMenu(): SongMenuContextValue {
  const ctx = useContext(SongMenuContext);
  if (!ctx) throw new Error('useSongMenu() doit être utilisé sous <SongMenuProvider>');
  return ctx;
}

function SongMenuSheet({ song, onClose }: { song: YTSong | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { playTrackRadio, enqueueNext, enqueueLast } = usePlayer();
  const { openAlbum, openArtist } = useMusicNavigation();
  const playlists = useLocalPlaylists();
  const toggleTrack = useToggleTrackInLibrary();
  const isLiked = useIsInMusicLibrary(song?.id ?? '');
  const [pickingPlaylist, setPickingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const close = useCallback(() => {
    setPickingPlaylist(false);
    setNewPlaylistName('');
    onClose();
  }, [onClose]);

  const run = useCallback(
    (action: () => void) => {
      action();
      close();
    },
    [close],
  );

  if (!song) return null;
  const track = songToTrack(song);
  const artist = song.artists.find((a) => a.id);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Image source={{ uri: song.thumbnail }} style={styles.cover} contentFit="cover" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {artistNames(song.artists)}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.actions} showsVerticalScrollIndicator={false}>
          {pickingPlaylist ? (
            <>
              <View style={styles.newPlaylistRow}>
                <TextInput
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  placeholder="Nouvelle playlist..."
                  placeholderTextColor={colors.muted}
                  style={styles.newPlaylistInput}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!newPlaylistName.trim()) return;
                    createLocalPlaylist(newPlaylistName).then((p) =>
                      addTrackToLocalPlaylist(p.id, track),
                    );
                    close();
                  }}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    if (!newPlaylistName.trim()) return;
                    createLocalPlaylist(newPlaylistName).then((p) =>
                      addTrackToLocalPlaylist(p.id, track),
                    );
                    close();
                  }}
                >
                  <Ionicons name="add-circle" size={28} color={colors.accent} />
                </Pressable>
              </View>
              {playlists.map((playlist) => (
                <MenuRow
                  key={playlist.id}
                  icon="list"
                  label={playlist.name}
                  detail={`${playlist.tracks.length} titre${playlist.tracks.length > 1 ? 's' : ''}`}
                  onPress={() => run(() => void addTrackToLocalPlaylist(playlist.id, track))}
                />
              ))}
            </>
          ) : (
            <>
              <MenuRow
                icon="play-forward"
                label="Lire ensuite"
                onPress={() => run(() => enqueueNext(track))}
              />
              <MenuRow
                icon="albums-outline"
                label="Ajouter à la file"
                onPress={() => run(() => enqueueLast(track))}
              />
              <MenuRow
                icon="radio-outline"
                label="Lancer la radio"
                onPress={() => run(() => playTrackRadio(track))}
              />
              <MenuRow
                icon={isLiked ? 'heart' : 'heart-outline'}
                label={isLiked ? 'Retirer des titres likés' : 'Ajouter aux titres likés'}
                highlighted={isLiked}
                onPress={() => run(() => toggleTrack(track))}
              />
              <MenuRow
                icon="add-circle-outline"
                label="Ajouter à une playlist"
                onPress={() => setPickingPlaylist(true)}
              />
              {song.album && (
                <MenuRow
                  icon="disc-outline"
                  label="Voir l'album"
                  detail={song.album.name}
                  onPress={() => run(() => openAlbum(song.album!.id, song.album!.name))}
                />
              )}
              {artist?.id && (
                <MenuRow
                  icon="person-outline"
                  label="Voir l'artiste"
                  detail={artist.name}
                  onPress={() => run(() => openArtist(artist.id!, artist.name))}
                />
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  detail,
  highlighted = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  highlighted?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={highlighted ? colors.accent : colors.text} />
      <View style={styles.menuRowText}>
        <Text style={[styles.menuLabel, highlighted && { color: colors.accent }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.menuDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '75%',
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    cover: {
      width: 52,
      height: 52,
      borderRadius: 4,
      backgroundColor: colors.surface,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    actions: {
      paddingTop: 6,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    pressed: {
      opacity: 0.6,
    },
    menuRowText: {
      flex: 1,
      gap: 1,
    },
    menuLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    menuDetail: {
      color: colors.muted,
      fontSize: 12,
    },
    newPlaylistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    newPlaylistInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
  });
}
