import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { searchArtists, type DeezerArtist } from '@/api/deezer';
import { searchVideos, searchVideosNextPage } from '@/api/youtube';
import type { VideoSummary } from '@/api/youtube';
import { ArtistCard } from '@/components/ArtistCard';
import { VideoListItem } from '@/components/VideoListItem';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { MiniPlayer } from '@/components/MiniPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
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
  const { contentBottomPadding } = useBottomOffsets();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VideoSummary[]>([]);
  const [artists, setArtists] = useState<DeezerArtist[]>([]);
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
      // La recherche d'artistes ne doit pas faire échouer la recherche vidéo :
      // en cas d'erreur Deezer on affiche simplement les vidéos seules.
      const [res, artistResults] = await Promise.all([
        searchVideos(trimmed),
        searchArtists(trimmed).catch(() => [] as DeezerArtist[]),
      ]);
      if (activeQuery.current !== trimmed) return; // une recherche plus récente a été lancée entre-temps
      setResults(dedupeById(res.items));
      setArtists(artistResults);
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

  // Navigation avec l'id Deezer : l'écran artiste charge alors directement le
  // bon profil, sans repasser par une recherche par nom ambiguë.
  const openArtistProfile = useCallback(
    (artist: DeezerArtist) => {
      router.push({
        pathname: '/music/artist',
        params: { artist: artist.name, artistId: String(artist.id) },
      });
    },
    [router],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Rechercher" />

      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Pressable onPress={() => runSearch(query)} hitSlop={8}>
            <Ionicons name="search" size={18} color={colors.muted} />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Rechercher des vidéos ou un artiste..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {status === 'idle' && (
        <EmptyView
          icon="search-outline"
          title="Trouve ta prochaine vidéo"
          message="Cherche des vidéos ou un artiste pour commencer."
        />
      )}
      {status === 'loading' && <LoadingView label="Recherche en cours..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => runSearch(query)} />}
      {status === 'ready' && results.length === 0 && artists.length === 0 && (
        <EmptyView icon="search-outline" title="Aucun résultat" message="Essaie avec d'autres mots-clés." />
      )}
      {status === 'ready' && (results.length > 0 || artists.length > 0) && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            artists.length > 0 ? (
              <View style={styles.artistsSection}>
                <Text style={styles.sectionLabel}>Artistes</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.artistsList}
                >
                  {artists.map((artist) => (
                    <View key={artist.id} style={styles.artistCardWrap}>
                      <ArtistCard artist={artist} onPress={() => openArtistProfile(artist)} />
                    </View>
                  ))}
                </ScrollView>
                {results.length > 0 && <Text style={styles.sectionLabel}>Vidéos</Text>}
              </View>
            ) : null
          }
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
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 10,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    artistsSection: {
      marginBottom: 4,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      marginTop: 4,
      marginBottom: 10,
    },
    artistsList: {
      paddingBottom: 8,
    },
    artistCardWrap: {
      marginRight: 12,
    },
  });
}
