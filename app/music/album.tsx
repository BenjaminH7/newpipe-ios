// Page album YouTube Music (browseId MPRE...) : pochette, artistes cliquables,
// liste numérotée des titres et actions de lecture — équivalent de
// l'AlbumScreen de Metrolist.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAlbumPage } from '@/api/ytmusic/client';
import { artistNames, songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import { resizeThumbnail } from '@/api/ytmusic/parse';
import type { AlbumPageData, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { DetailHeader } from '@/components/music/DetailHeader';
import { SongRow } from '@/components/music/SongRow';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useIsAlbumSaved } from '@/hooks/useMusicCollections';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { savedAlbumsStore } from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

export default function AlbumScreen() {
  const { browseId, title, thumbnail } = useLocalSearchParams<{
    browseId: string;
    title?: string;
    thumbnail?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack, toggleShuffle, shuffle } = usePlayer();
  const { openArtist } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [album, setAlbum] = useState<AlbumPageData | null>(null);
  const saved = useIsAlbumSaved(browseId ?? null);

  const load = useCallback(async () => {
    if (!browseId) return;
    setStatus('loading');
    setError(null);
    try {
      setAlbum(await getAlbumPage(browseId));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'album.");
      setStatus('error');
    }
  }, [browseId]);

  useEffect(() => {
    load();
  }, [load]);

  const playFrom = useCallback(
    (song: YTSong) => {
      if (!album) return;
      playTrack(songToTrack(song), songsToTracks(album.songs));
    },
    [album, playTrack],
  );

  const playAll = useCallback(() => {
    if (album && album.songs.length > 0) playFrom(album.songs[0]);
  }, [album, playFrom]);

  const shuffleAll = useCallback(() => {
    if (!album || album.songs.length === 0) return;
    if (!shuffle) toggleShuffle();
    playFrom(album.songs[Math.floor(Math.random() * album.songs.length)]);
  }, [album, playFrom, shuffle, toggleShuffle]);

  const toggleSave = useCallback(() => {
    if (!album) return;
    savedAlbumsStore.toggle({
      browseId: album.browseId,
      title: album.title,
      artist: artistNames(album.artists),
      year: album.year,
      thumbnail: album.thumbnail,
      savedAt: Date.now(),
    });
  }, [album]);

  const headerCover = resizeThumbnail(album?.thumbnail || thumbnail || '', 544);
  const firstArtist = album?.artists.find((a) => a.id);

  return (
    <View style={styles.container}>
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>

      {status === 'loading' && <LoadingView label={title || "Chargement de l'album..."} />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' && album && (
        <FlatList
          data={album.songs}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={[
            styles.list,
            { paddingTop: insets.top + 52, paddingBottom: contentBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <DetailHeader
              thumbnail={headerCover}
              title={album.title}
              subtitle={artistNames(album.artists) || album.subtitle}
              secondSubtitle={album.secondSubtitle}
              saved={saved}
              onToggleSave={toggleSave}
              onPlay={playAll}
              onShuffle={shuffleAll}
              onSubtitlePress={
                firstArtist?.id ? () => openArtist(firstArtist.id!, firstArtist.name) : undefined
              }
            />
          }
          ListEmptyComponent={<EmptyView message="Aucun titre dans cet album." />}
          renderItem={({ item, index }) => (
            <SongRow
              song={item}
              index={index + 1}
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
      paddingHorizontal: 20,
    },
  });
}
