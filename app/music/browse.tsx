// Page « Voir tout » générique : rend n'importe quel browseId de catalogue
// (albums d'un artiste, catégorie de mood, étagère de l'accueil) sous forme de
// grille ou de liste de titres, comme le BrowseScreen de Metrolist.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getArtistItems } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { YTItem, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { CARD_WIDTH, ItemCard } from '@/components/music/ItemCard';
import { SongRow } from '@/components/music/SongRow';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

const COLUMNS = 2;

export default function BrowseScreen() {
  const { browseId, params, title } = useLocalSearchParams<{
    browseId: string;
    params?: string;
    title?: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YTItem[]>([]);
  const [pageTitle, setPageTitle] = useState(title ?? '');

  const load = useCallback(async () => {
    if (!browseId) return;
    setStatus('loading');
    setError(null);
    try {
      const page = await getArtistItems(browseId, params || undefined);
      setItems(page.items);
      if (page.title) setPageTitle(page.title);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger cette page.');
      setStatus('error');
    }
  }, [browseId, params]);

  useEffect(() => {
    load();
  }, [load]);

  const songs = useMemo(() => items.filter((i): i is YTSong => i.type === 'song'), [items]);
  // Page de titres : liste pleine largeur ; sinon grille de cartes.
  const songsOnly = songs.length === items.length && songs.length > 0;

  const playSong = useCallback(
    (song: YTSong) => {
      playTrack(songToTrack(song), songsToTracks(songs.length > 0 ? songs : [song]));
    },
    [playTrack, songs],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: pageTitle || 'Parcourir' }} />
      {status === 'loading' && <LoadingView />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' && (
        <FlatList
          key={songsOnly ? 'list' : 'grid'}
          data={items}
          numColumns={songsOnly ? 1 : COLUMNS}
          columnWrapperStyle={songsOnly ? undefined : styles.column}
          keyExtractor={(item, index) =>
            `${item.type}-${
              item.type === 'song'
                ? item.id
                : item.type === 'playlist'
                  ? item.playlistId
                  : item.browseId
            }-${index}`
          }
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyView message="Rien à afficher ici." />}
          renderItem={({ item }) =>
            item.type === 'song' ? (
              <SongRow
                song={item}
                isActive={item.id === currentTrack?.id}
                isPlaying={isPlaying}
                onPress={() => playSong(item)}
                onMenu={() => showSongMenu(item)}
              />
            ) : (
              <ItemCard item={item} width={CARD_WIDTH} onPress={() => openItem(item)} />
            )
          }
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
    list: {
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 18,
    },
    column: {
      justifyContent: 'space-between',
    },
  });
}
