import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { searchVideos, searchVideosNextPage } from '@/api/youtube';
import type { VideoSummary } from '@/api/youtube';
import { VideoListItem } from '@/components/VideoListItem';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { MiniPlayer } from '@/components/MiniPlayer';
import { useTheme, type ColorPalette } from '@/theme';

function dedupeById(items: VideoSummary[]): VideoSummary[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

type Status = 'idle' | 'loading' | 'error' | 'ready';

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VideoSummary[]>([]);
  const [nextpage, setNextpage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const activeQuery = useRef('');

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    activeQuery.current = trimmed;
    setStatus('loading');
    setError(null);
    try {
      const res = await searchVideos(trimmed);
      if (activeQuery.current !== trimmed) return; // une recherche plus récente a été lancée entre-temps
      setResults(dedupeById(res.items));
      setNextpage(res.nextpage);
      setStatus('ready');
    } catch (e) {
      if (activeQuery.current !== trimmed) return;
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextpage || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    try {
      const q = activeQuery.current;
      const res = await searchVideosNextPage(nextpage);
      if (activeQuery.current !== q) return;
      setResults((prev) => dedupeById([...prev, ...res.items]));
      setNextpage(res.nextpage);
    } catch {
      // On échoue silencieusement sur la pagination : l'utilisateur garde les résultats déjà chargés.
    } finally {
      setLoadingMore(false);
    }
  }, [nextpage, loadingMore, status]);

  const openArtist = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push({ pathname: '/music/artist', params: { artist: trimmed } });
  }, [query, router]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Pressable onPress={() => runSearch(query)} hitSlop={8}>
          <Ionicons name="search" size={18} color={colors.muted} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          placeholder="Rechercher des vidéos ou un artiste..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Pressable onPress={openArtist} hitSlop={8} disabled={!query.trim()}>
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={query.trim() ? colors.accent : colors.border}
          />
        </Pressable>
      </View>

      {status === 'idle' && <EmptyView message="Cherche une vidéo pour commencer." />}
      {status === 'loading' && <LoadingView label="Recherche en cours..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => runSearch(query)} />}
      {status === 'ready' && results.length === 0 && (
        <EmptyView message="Aucune vidéo trouvée." />
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
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} /> : null}
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
    },
    list: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
  });
}
