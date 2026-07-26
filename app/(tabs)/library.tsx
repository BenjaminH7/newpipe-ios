// Bibliothèque, calquée sur le LibraryScreen de Metrolist : un sélecteur de
// filtre (Titres / Albums / Artistes / Playlists) au-dessus d'une seule liste.
// Contrairement à Metrolist il n'y a pas de compte Google connecté : le contenu
// vient de ce qui a été liké, enregistré ou suivi dans l'app.
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicTrackItem } from '@/components/MusicTrackItem';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useFollowedArtists } from '@/hooks/useFollowedArtists';
import {
  useLocalPlaylists,
  useSavedAlbums,
  useSavedPlaylists,
} from '@/hooks/useMusicCollections';
import { useMusicLibrary, useRemoveMusicTrack, useRetryMusicDownload } from '@/hooks/useMusicLibrary';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { createLocalPlaylist } from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';

type Tab = 'songs' | 'albums' | 'artists' | 'playlists';

const TABS: { key: Tab; label: string }[] = [
  { key: 'songs', label: 'Titres' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artistes' },
  { key: 'playlists', label: 'Playlists' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openAlbum, openArtist, openPlaylist } = useMusicNavigation();

  const tracks = useMusicLibrary();
  const albums = useSavedAlbums();
  const artists = useFollowedArtists();
  const savedPlaylists = useSavedPlaylists();
  const localPlaylists = useLocalPlaylists();
  const removeTrack = useRemoveMusicTrack();
  const retryDownload = useRetryMusicDownload();

  const [tab, setTab] = useState<Tab>('songs');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const matches = useCallback(
    (...fields: (string | null | undefined)[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return fields.some((f) => f?.toLowerCase().includes(q));
    },
    [query],
  );

  const filteredTracks = useMemo(
    () => tracks.filter((t) => matches(t.title, t.artist)),
    [tracks, matches],
  );

  const submitNewPlaylist = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    createLocalPlaylist(name);
    setNewName('');
    setCreating(false);
  }, [newName]);

  const subtitle = useMemo(() => {
    switch (tab) {
      case 'songs':
        return `${tracks.length} titre${tracks.length > 1 ? 's' : ''}`;
      case 'albums':
        return `${albums.length} album${albums.length > 1 ? 's' : ''}`;
      case 'artists':
        return `${artists.length} artiste${artists.length > 1 ? 's' : ''}`;
      case 'playlists':
        return `${localPlaylists.length + savedPlaylists.length} playlist${
          localPlaylists.length + savedPlaylists.length > 1 ? 's' : ''
        }`;
    }
  }, [tab, tracks.length, albums.length, artists.length, localPlaylists.length, savedPlaylists.length]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Bibliothèque"
        subtitle={subtitle}
        right={
          tab === 'playlists' ? (
            <Pressable
              hitSlop={8}
              onPress={() => setCreating((v) => !v)}
              accessibilityLabel="Nouvelle playlist"
            >
              <Ionicons name={creating ? 'close' : 'add'} size={28} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={({ pressed }) => [
              styles.tabChip,
              tab === t.key && styles.tabChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {creating && tab === 'playlists' && (
        <View style={styles.createRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nom de la playlist"
            placeholderTextColor={colors.muted}
            style={styles.createInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitNewPlaylist}
          />
          <Pressable hitSlop={8} onPress={submitNewPlaylist}>
            <Ionicons name="checkmark-circle" size={30} color={colors.accent} />
          </Pressable>
        </View>
      )}

      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher dans la bibliothèque"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {tab === 'songs' && (
        <FlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyView
              icon="heart-outline"
              title={tracks.length === 0 ? 'Aucun titre liké' : 'Aucun résultat'}
              message={
                tracks.length === 0
                  ? 'Ouvre le menu d’un titre et choisis « Ajouter aux titres likés » pour le retrouver ici, disponible hors connexion.'
                  : 'Essaie un autre terme.'
              }
            />
          }
          renderItem={({ item }) => (
            <MusicTrackItem
              track={item}
              isActive={currentTrack?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playTrack(item, filteredTracks)}
              onArtistPress={() => router.push({ pathname: '/music/artist', params: { artist: item.artist } })}
              onRemove={() => removeTrack(item.id)}
              onRetryDownload={() => retryDownload(item.id)}
            />
          )}
        />
      )}

      {tab === 'albums' && (
        <FlatList
          data={albums.filter((a) => matches(a.title, a.artist))}
          keyExtractor={(item) => item.browseId}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyView
              icon="disc-outline"
              title="Aucun album enregistré"
              message="Appuie sur le signet d’une page album pour la garder ici."
            />
          }
          renderItem={({ item }) => (
            <CollectionRow
              thumbnail={item.thumbnail}
              title={item.title}
              subtitle={[item.artist, item.year].filter(Boolean).join(' • ')}
              onPress={() => openAlbum(item.browseId, item.title, item.thumbnail)}
            />
          )}
        />
      )}

      {tab === 'artists' && (
        <FlatList
          data={artists.filter((a) => matches(a.name))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyView
              icon="person-outline"
              title="Aucun artiste suivi"
              message="Appuie sur « Suivre » sur la page d’un artiste : ses nouvelles sorties apparaîtront dans Nouveautés."
            />
          }
          renderItem={({ item }) => (
            <CollectionRow
              thumbnail={item.pictureUrl ?? ''}
              title={item.name}
              subtitle="Artiste"
              round
              onPress={() => openArtist(item.id, item.name)}
            />
          )}
        />
      )}

      {tab === 'playlists' && (
        <FlatList
          data={[
            ...localPlaylists
              .filter((p) => matches(p.name))
              .map((p) => ({ kind: 'local' as const, item: p })),
            ...savedPlaylists
              .filter((p) => matches(p.title, p.author))
              .map((p) => ({ kind: 'saved' as const, item: p })),
          ]}
          keyExtractor={(entry) =>
            entry.kind === 'local' ? entry.item.id : `saved-${entry.item.playlistId}`
          }
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyView
              icon="list-outline"
              title="Aucune playlist"
              message="Crée une playlist avec le bouton +, ou enregistre une playlist YouTube Music depuis sa page."
            />
          }
          renderItem={({ item: entry }) =>
            entry.kind === 'local' ? (
              <CollectionRow
                thumbnail={entry.item.tracks[0]?.coverArtUrl ?? ''}
                title={entry.item.name}
                subtitle={`${entry.item.tracks.length} titre${entry.item.tracks.length > 1 ? 's' : ''}`}
                icon="list"
                onPress={() =>
                  router.push({ pathname: '/music/local-playlist', params: { id: entry.item.id } })
                }
              />
            ) : (
              <CollectionRow
                thumbnail={entry.item.thumbnail}
                title={entry.item.title}
                subtitle={entry.item.author ?? 'Playlist YouTube Music'}
                onPress={() =>
                  openPlaylist(entry.item.playlistId, entry.item.title, entry.item.thumbnail)
                }
              />
            )
          }
        />
      )}

      <MiniPlayer />
    </View>
  );
}

function CollectionRow({
  thumbnail,
  title,
  subtitle,
  round = false,
  icon = 'musical-notes',
  onPress,
}: {
  thumbnail: string;
  title: string;
  subtitle: string;
  round?: boolean;
  icon?: 'musical-notes' | 'list' | 'person';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={[styles.rowCover, round && styles.roundCover]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.rowCover, round && styles.roundCover, styles.coverFallback]}>
          <Ionicons name={round ? 'person' : icon} size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
    tabsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 6,
    },
    tabChip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    tabChipActive: {
      backgroundColor: colors.text,
    },
    tabLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    tabLabelActive: {
      color: colors.background,
    },
    createRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    createInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    searchBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 10,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 11,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
    },
    rowCover: {
      width: 54,
      height: 54,
      borderRadius: 4,
      backgroundColor: colors.surface,
    },
    roundCover: {
      borderRadius: 27,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
  });
}
