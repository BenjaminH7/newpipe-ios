import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { searchVideos, searchVideosNextPage, type VideoSummary } from '@/api/youtube';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { MiniPlayer } from '@/components/MiniPlayer';
import { VideoListItem } from '@/components/VideoListItem';
import { useTheme, type ColorPalette } from '@/theme';

type SearchParams = { artist: string };
type Status = 'loading' | 'error' | 'ready';

function dedupeById(items: VideoSummary[]): VideoSummary[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

// "Le plus populaire au moins populaire" : YouTube trie les résultats de
// recherche par pertinence, pas par nombre de vues, donc on re-trie côté
// client (et on re-trie de nouveau à chaque page suivante chargée).
function sortByViews(items: VideoSummary[]): VideoSummary[] {
  return [...items].sort((a, b) => b.views - a.views);
}

export default function ArtistScreen() {
  const { artist } = useLocalSearchParams<SearchParams>();
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VideoSummary[]>([]);
  const [nextpage, setNextpage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const activeArtist = useRef('');

  const load = useCallback(async (name: string) => {
    activeArtist.current = name;
    setStatus('loading');
    setError(null);
    try {
      const res = await searchVideos(name);
      if (activeArtist.current !== name) return;
      setResults(sortByViews(dedupeById(res.items)));
      setNextpage(res.nextpage);
      setStatus('ready');
    } catch (e) {
      if (activeArtist.current !== name) return;
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (artist) load(artist);
  }, [artist, load]);

  const loadMore = useCallback(async () => {
    if (!nextpage || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    try {
      const name = activeArtist.current;
      const res = await searchVideosNextPage(nextpage);
      if (activeArtist.current !== name) return;
      setResults((prev) => sortByViews(dedupeById([...prev, ...res.items])));
      setNextpage(res.nextpage);
    } catch {
      // Pagination best-effort : on garde les résultats déjà chargés.
    } finally {
      setLoadingMore(false);
    }
  }, [nextpage, loadingMore, status]);

  return (
    <View style={styles.container}>
      <Text style={[sharedStyles.text, styles.heading]} numberOfLines={2}>
        {artist}
      </Text>

      {status === 'loading' && <LoadingView label="Recherche des titres..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => load(artist)} />}
      {status === 'ready' && results.length === 0 && (
        <EmptyView message="Aucun titre trouvé pour cet artiste." />
      )}
      {status === 'ready' && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <VideoListItem
              video={item}
              onPress={() =>
                router.push({
                  pathname: '/video/[id]',
                  params: {
                    id: item.id,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    channelId: item.channelId ?? '',
                    channelName: item.channelName,
                    channelAvatar: item.channelAvatar ?? '',
                    uploadedDate: item.uploadedDate ?? '',
                    views: String(item.views),
                    duration: String(item.duration),
                  },
                })
              }
            />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footerLoader} /> : null
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
    heading: {
      fontSize: 24,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    list: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    footerLoader: {
      marginVertical: 16,
    },
  });
}
