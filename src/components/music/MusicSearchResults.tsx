// Résultats de recherche : barre de filtres (titres, vidéos, albums, artistes,
// playlists, podcasts, épisodes), liste paginée par continuation et lecture
// d'un titre dans la file des titres affichés. Le filtre « Vidéos » sort du
// catalogue YouTube Music et interroge la recherche vidéo YouTube ordinaire,
// pour que l'accueil couvre aussi ce qui n'existe pas dans YouTube Music
// (clips, lives, vidéos). Un épisode de podcast est un titre comme un autre
// (videoId), une émission ouvre la page playlist de ses épisodes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { searchVideos, searchVideosNextPage, type VideoSummary } from '@/api/youtube';
import { searchMusic, searchMusicContinuation, type MusicSearchFilter } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { YTItem, YTSong } from '@/api/ytmusic/types';
import { EmptyView, ErrorView } from '@/components/StatusView';
import { VideoListItem } from '@/components/VideoListItem';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';
import { itemKey, itemSubtitle } from './ItemCard';
import { SongRow } from './SongRow';
import { useSongMenu } from './SongMenu';

/** `videos` = recherche vidéo YouTube ; les autres clés sont des filtres YouTube Music. */
type ResultFilter = MusicSearchFilter | 'videos';

const FILTERS: { key: ResultFilter; label: string }[] = [
  { key: 'songs', label: 'Titres' },
  { key: 'videos', label: 'Vidéos' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artistes' },
  { key: 'communityPlaylists', label: 'Playlists' },
  { key: 'podcasts', label: 'Podcasts' },
  { key: 'episodes', label: 'Épisodes' },
];

type Status = 'idle' | 'loading' | 'error' | 'ready';

function dedupeById(items: VideoSummary[]): VideoSummary[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** `query` est la recherche validée : vide = rien à afficher (état géré par l'écran parent). */
export function MusicSearchResults({ query }: { query: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [filter, setFilter] = useState<ResultFilter>('songs');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YTItem[]>([]);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  // Jeton de page suivante : `continuation` côté YouTube Music, `nextpage` côté vidéos.
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Jeton anti-course : une frappe rapide peut faire revenir une réponse
  // périmée après la plus récente.
  const requestRef = useRef(0);

  const runSearch = useCallback(async (text: string, activeFilter: ResultFilter) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus('idle');
      setItems([]);
      setVideos([]);
      return;
    }
    const token = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      if (activeFilter === 'videos') {
        const result = await searchVideos(trimmed);
        if (requestRef.current !== token) return;
        setVideos(dedupeById(result.items));
        setContinuation(result.nextpage);
      } else {
        const result = await searchMusic(trimmed, activeFilter);
        if (requestRef.current !== token) return;
        setItems(result.items);
        setContinuation(result.continuation);
      }
      setStatus('ready');
    } catch (e) {
      if (requestRef.current !== token) return;
      setError(e instanceof Error ? e.message : 'La recherche a échoué.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    runSearch(query, filter);
  }, [query, filter, runSearch]);

  const loadMore = useCallback(async () => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    const token = requestRef.current;
    try {
      if (filter === 'videos') {
        const next = await searchVideosNextPage(continuation);
        if (requestRef.current !== token) return;
        setVideos((prev) => dedupeById([...prev, ...next.items]));
        setContinuation(next.nextpage);
      } else {
        const next = await searchMusicContinuation(continuation);
        if (requestRef.current !== token) return;
        setItems((prev) => {
          const known = new Set(prev.map(itemKey));
          return [...prev, ...next.items.filter((i) => !known.has(itemKey(i)))];
        });
        setContinuation(next.continuation);
      }
    } catch {
      setContinuation(null);
    } finally {
      setLoadingMore(false);
    }
  }, [continuation, filter, loadingMore]);

  const openVideo = useCallback(
    (video: VideoSummary) => {
      router.push({
        pathname: '/video/[id]',
        params: {
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          channelId: video.channelId ?? '',
          channelName: video.channelName,
          channelAvatar: video.channelAvatar ?? '',
          uploadedDate: video.uploadedDate ?? '',
          views: String(video.views),
          duration: String(video.duration),
        },
      });
    },
    [router],
  );

  const songs = useMemo(() => items.filter((i): i is YTSong => i.type === 'song'), [items]);

  const playSong = useCallback(
    (song: YTSong) => {
      playTrack(songToTrack(song), songsToTracks(songs.length > 0 ? songs : [song]));
    },
    [playTrack, songs],
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={({ pressed }) => [
              styles.filterChip,
              filter === f.key && styles.filterChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {status === 'loading' && <ActivityIndicator color={colors.accent} style={styles.loader} />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => runSearch(query, filter)} />}
      {status === 'ready' && filter === 'videos' && (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={<EmptyView message="Aucune vidéo trouvée." />}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.muted} style={styles.loader} /> : null
          }
          renderItem={({ item }) => <VideoListItem video={item} onPress={() => openVideo(item)} />}
        />
      )}
      {status === 'ready' && filter !== 'videos' && (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${itemKey(item)}-${index}`}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={<EmptyView message="Aucun résultat." />}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.muted} style={styles.loader} /> : null
          }
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
              <ResultRow item={item} onPress={() => openItem(item)} />
            )
          }
        />
      )}
    </>
  );
}

/** Rangée d'un résultat non-titre (album, artiste, playlist). */
function ResultRow({ item, onPress }: { item: YTItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const round = item.type === 'artist';
  const title = item.type === 'artist' ? item.name : item.title;
  const podcast = item.type === 'playlist' && item.podcast === true;
  const fallbackIcon = round ? 'person' : podcast ? 'mic' : 'musical-notes';

  return (
    <Pressable style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]} onPress={onPress}>
      {item.thumbnail ? (
        <Image
          source={{ uri: item.thumbnail }}
          style={[styles.resultCover, round && styles.roundCover]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.resultCover, round && styles.roundCover, styles.coverFallback]}>
          <Ionicons name={fallbackIcon} size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {itemSubtitle(item)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    filterScroll: {
      flexGrow: 0,
    },
    filterRow: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.text,
    },
    filterLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    filterLabelActive: {
      color: colors.background,
    },
    // flexGrow: 1 pour que les <EmptyView /> centrés ne s'écrasent pas à zéro.
    list: {
      flexGrow: 1,
      paddingHorizontal: 20,
    },
    loader: {
      marginVertical: 24,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
    },
    resultCover: {
      width: 52,
      height: 52,
      borderRadius: 4,
      backgroundColor: colors.surface,
    },
    roundCover: {
      borderRadius: 26,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultInfo: {
      flex: 1,
      gap: 3,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    resultSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
  });
}
