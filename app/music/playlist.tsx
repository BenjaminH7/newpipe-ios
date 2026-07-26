// Page playlist YouTube Music (browseId VL<playlistId>) : en-tête, titres
// paginés par continuation et enregistrement dans la bibliothèque — équivalent
// de l'OnlinePlaylistScreen de Metrolist.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getPlaylistContinuation, getPlaylistPage } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import { resizeThumbnail } from '@/api/ytmusic/parse';
import type { PlaylistPageData, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { DetailHeader } from '@/components/music/DetailHeader';
import { SongRow } from '@/components/music/SongRow';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useIsPlaylistSaved } from '@/hooks/useMusicCollections';
import { usePlayer } from '@/player/PlayerContext';
import { savedPlaylistsStore } from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

export default function PlaylistScreen() {
  const { playlistId, title, thumbnail } = useLocalSearchParams<{
    playlistId: string;
    title?: string;
    thumbnail?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack, playTrackRadio, toggleShuffle, shuffle } = usePlayer();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistPageData | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const saved = useIsPlaylistSaved(playlistId ?? null);

  const load = useCallback(async () => {
    if (!playlistId) return;
    setStatus('loading');
    setError(null);
    try {
      setPlaylist(await getPlaylistPage(playlistId));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger la playlist.');
      setStatus('error');
    }
  }, [playlistId]);

  useEffect(() => {
    load();
  }, [load]);

  // Les playlists YouTube Music arrivent par tranches de ~100 titres.
  const loadMore = useCallback(async () => {
    if (!playlist?.continuation || loadingMore) return;
    setLoadingMore(true);
    try {
      // Une émission podcast pagine ses épisodes comme une playlist ; son nom
      // est réinjecté dans chaque épisode, page suivante comprise.
      const next = await getPlaylistContinuation(
        playlist.continuation,
        playlist.browseId.startsWith('MPSP') ? playlist.title : undefined,
      );
      setPlaylist((prev) => {
        if (!prev) return prev;
        // Certaines playlists auto-générées renvoient leur première page en
        // guise de continuation : sans ce filtre, les titres se dupliquent.
        const known = new Set(prev.songs.map((s) => s.id));
        const fresh = next.songs.filter((s) => !known.has(s.id));
        return {
          ...prev,
          songs: [...prev.songs, ...fresh],
          continuation: fresh.length > 0 ? next.continuation : null,
        };
      });
    } catch {
      setPlaylist((prev) => (prev ? { ...prev, continuation: null } : prev));
    } finally {
      setLoadingMore(false);
    }
  }, [playlist?.continuation, loadingMore]);

  const playFrom = useCallback(
    (song: YTSong) => {
      if (!playlist) return;
      playTrack(songToTrack(song), songsToTracks(playlist.songs));
    },
    [playlist, playTrack],
  );

  const playAll = useCallback(() => {
    if (playlist && playlist.songs.length > 0) playFrom(playlist.songs[0]);
  }, [playlist, playFrom]);

  const shuffleAll = useCallback(() => {
    if (!playlist || playlist.songs.length === 0) return;
    if (!shuffle) toggleShuffle();
    playFrom(playlist.songs[Math.floor(Math.random() * playlist.songs.length)]);
  }, [playlist, playFrom, shuffle, toggleShuffle]);

  const startRadio = useCallback(() => {
    if (playlist && playlist.songs.length > 0) playTrackRadio(songToTrack(playlist.songs[0]));
  }, [playlist, playTrackRadio]);

  const toggleSave = useCallback(() => {
    if (!playlist) return;
    savedPlaylistsStore.toggle({
      playlistId: playlist.playlistId,
      title: playlist.title,
      author: playlist.author,
      thumbnail: playlist.thumbnail,
      savedAt: Date.now(),
    });
  }, [playlist]);

  return (
    <View style={styles.container}>
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>

      {status === 'loading' && <LoadingView label={title || 'Chargement de la playlist...'} />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' && playlist && (
        <FlatList
          data={playlist.songs}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={[
            styles.list,
            { paddingTop: insets.top + 52, paddingBottom: contentBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            <DetailHeader
              thumbnail={resizeThumbnail(playlist.thumbnail || thumbnail || '', 544)}
              title={playlist.title}
              subtitle={playlist.author ?? playlist.subtitle}
              secondSubtitle={playlist.secondSubtitle}
              saved={saved}
              onToggleSave={toggleSave}
              onPlay={playAll}
              onShuffle={shuffleAll}
              onRadio={startRadio}
            />
          }
          ListEmptyComponent={<EmptyView message="Cette playlist est vide." />}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.muted} style={styles.loader} /> : null
          }
          renderItem={({ item }) => (
            <SongRow
              song={item}
              isActive={item.id === currentTrack?.id}
              isPlaying={isPlaying}
              onPress={() => playFrom(item)}
              onMenu={() => showSongMenu(item)}
            />
          )}
        />
      )}
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
    backButton: {
      position: 'absolute',
      left: 12,
      zIndex: 20,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 20,
    },
    loader: {
      marginVertical: 20,
    },
  });
}
