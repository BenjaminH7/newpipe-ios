// Recherche YouTube Music, reprise de l'OnlineSearchResult de Metrolist :
// suggestions pendant la frappe, puis résultats filtrés par type (titres,
// albums, artistes, playlists) avec pagination par continuation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getMusicSearchSuggestions,
  searchMusic,
  searchMusicContinuation,
  type MusicSearchFilter,
} from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { YTItem, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { itemSubtitle } from '@/components/music/ItemCard';
import { SongRow } from '@/components/music/SongRow';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

const FILTERS: { key: MusicSearchFilter; label: string }[] = [
  { key: 'songs', label: 'Titres' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artistes' },
  { key: 'communityPlaylists', label: 'Playlists' },
];

type Status = 'idle' | 'loading' | 'error' | 'ready';

export default function MusicSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [query, setQuery] = useState(q ?? '');
  const [submitted, setSubmitted] = useState(q ?? '');
  const [filter, setFilter] = useState<MusicSearchFilter>('songs');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YTItem[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Jeton anti-course : une frappe rapide peut faire revenir une réponse
  // périmée après la plus récente.
  const requestRef = useRef(0);

  const runSearch = useCallback(async (text: string, activeFilter: MusicSearchFilter) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus('idle');
      setItems([]);
      return;
    }
    const token = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const result = await searchMusic(trimmed, activeFilter);
      if (requestRef.current !== token) return;
      setItems(result.items);
      setContinuation(result.continuation);
      setStatus('ready');
    } catch (e) {
      if (requestRef.current !== token) return;
      setError(e instanceof Error ? e.message : 'La recherche a échoué.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (submitted) runSearch(submitted, filter);
  }, [submitted, filter, runSearch]);

  // Suggestions au fil de la frappe (debounce court, comme YouTube Music).
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed === submitted) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      getMusicSearchSuggestions(trimmed)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [query, submitted]);

  const submit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(trimmed);
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();
  }, []);

  const loadMore = useCallback(async () => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await searchMusicContinuation(continuation);
      setItems((prev) => [...prev, ...next.items]);
      setContinuation(next.continuation);
    } catch {
      setContinuation(null);
    } finally {
      setLoadingMore(false);
    }
  }, [continuation, loadingMore]);

  const songs = useMemo(() => items.filter((i): i is YTSong => i.type === 'song'), [items]);

  const playSong = useCallback(
    (song: YTSong) => {
      playTrack(songToTrack(song), songsToTracks(songs.length > 0 ? songs : [song]));
    },
    [playTrack, songs],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.searchField}>
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Titres, albums, artistes..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={!q}
            onSubmitEditing={() => submit(query)}
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {showSuggestions && suggestions.length > 0 ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
              onPress={() => submit(suggestion)}
            >
              <Ionicons name="search" size={18} color={colors.muted} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {suggestion}
              </Text>
              <Pressable hitSlop={8} onPress={() => setQuery(suggestion)}>
                <Ionicons name="arrow-up-outline" size={18} color={colors.muted} style={styles.fillIcon} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <>
          {submitted ? (
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
          ) : null}

          {status === 'idle' && (
            <EmptyView
              icon="search-outline"
              title="Que veux-tu écouter ?"
              message="Cherche un titre, un album, un artiste ou une playlist sur YouTube Music."
            />
          )}
          {status === 'loading' && <ActivityIndicator color={colors.accent} style={styles.loader} />}
          {status === 'error' && (
            <ErrorView message={error ?? ''} onRetry={() => runSearch(submitted, filter)} />
          )}
          {status === 'ready' && (
            <FlatList
              data={items}
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
      )}

      <MiniPlayer />
    </View>
  );
}

/** Rangée d'un résultat non-titre (album, artiste, playlist). */
function ResultRow({ item, onPress }: { item: YTItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const round = item.type === 'artist';
  const title = item.type === 'artist' ? item.name : item.title;

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
          <Ionicons name={round ? 'person' : 'musical-notes'} size={22} color={colors.muted} />
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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pressed: {
      opacity: 0.6,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      paddingVertical: 11,
    },
    suggestions: {
      flex: 1,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    suggestionText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
    },
    fillIcon: {
      transform: [{ rotate: '-45deg' }],
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
    list: {
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
