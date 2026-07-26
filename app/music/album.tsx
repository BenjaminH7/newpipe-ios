import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAlbum, type DeezerAlbumDetails, type DeezerTrack } from '@/api/deezer';
import { toMusicTrack } from '@/api/musicMatch';
import { ArtistTrackRow } from '@/components/ArtistTrackRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useYoutubeResolution } from '@/hooks/useYoutubeResolution';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';

type SearchParams = { albumId: string; title?: string; coverUrl?: string };
type Status = 'loading' | 'error' | 'ready';

const PLAY_BUTTON_SIZE = 58;

const RECORD_TYPE_LABELS: Record<string, string> = {
  album: 'Album',
  single: 'Single',
  ep: 'EP',
  compile: 'Compilation',
};

export default function AlbumScreen() {
  const { albumId, title: titleParam, coverUrl: coverUrlParam } = useLocalSearchParams<SearchParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currentTrack, isPlaying, playTrack } = usePlayer();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [album, setAlbum] = useState<DeezerAlbumDetails | null>(null);
  // Référence stable obligatoire : un `album?.tracks ?? []` inline recrée un
  // tableau à chaque rendu et fait boucler l'effet de useYoutubeResolution.
  const tracks = useMemo(() => album?.tracks ?? [], [album]);
  const { resolved, resolvedRef, resolveTrack } = useYoutubeResolution(tracks);

  const load = useCallback(async (id: string) => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getAlbum(Number(id));
      if (!result) {
        setError('Album introuvable.');
        setStatus('error');
        return;
      }
      setAlbum(result);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (albumId) load(albumId);
  }, [albumId, load]);

  const openArtist = useCallback(() => {
    if (album?.artistName) {
      router.push({ pathname: '/music/artist', params: { artist: album.artistName } });
    }
  }, [album, router]);

  const handlePressTrack = useCallback(
    async (track: DeezerTrack) => {
      const video = await resolveTrack(track);
      if (!video) {
        Alert.alert('Introuvable', `Impossible de trouver "${track.title}" sur YouTube.`);
        return;
      }

      const merged = { ...resolvedRef.current, [track.id]: video };
      const queue = tracks
        .map((t) => {
          const v = merged[t.id];
          return v && v !== 'pending' ? toMusicTrack(v, t) : null;
        })
        .filter((t): t is MusicTrack => t !== null);

      playTrack(toMusicTrack(video, track), queue);
    },
    [tracks, playTrack, resolveTrack, resolvedRef],
  );

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) handlePressTrack(tracks[0]);
  }, [tracks, handlePressTrack]);

  const coverUrl = album?.coverUrl || coverUrlParam || null;
  const title = album?.title ?? titleParam ?? '';
  const year = album?.releaseDate ? album.releaseDate.slice(0, 4) : '';
  const typeLabel = album ? RECORD_TYPE_LABELS[album.recordType] ?? '' : '';
  const trackCountLabel =
    album && album.trackCount >= 0 ? `${album.trackCount} titre${album.trackCount > 1 ? 's' : ''}` : '';
  const metaLine = [typeLabel, year, trackCountLabel].filter(Boolean).join(' • ');

  return (
    <View style={styles.container}>
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      {status === 'loading' && <LoadingView label="Chargement de l'album..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => load(albumId)} />}
      {status === 'ready' && (
        <FlatList
          data={tracks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Ionicons name="disc" size={64} color={colors.muted} />
                </View>
              )}
              <Text style={[sharedStyles.text, styles.title]} numberOfLines={3}>
                {title}
              </Text>
              {album?.artistName ? (
                <Pressable hitSlop={8} onPress={openArtist}>
                  <Text style={[styles.artistLink, { color: colors.accent }]} numberOfLines={1}>
                    {album.artistName}
                  </Text>
                </Pressable>
              ) : null}
              {metaLine ? <Text style={sharedStyles.mutedText}>{metaLine}</Text> : null}

              <View style={styles.actionsRow}>
                <Pressable
                  hitSlop={8}
                  onPress={handlePlayAll}
                  disabled={tracks.length === 0}
                  style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
                >
                  <Ionicons name="play" size={26} color={colors.accentText} style={styles.playIcon} />
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const video = resolved[item.id];
            const activeVideo = video && video !== 'pending' ? video : null;
            const isActive = !!currentTrack && !!activeVideo && activeVideo.id === currentTrack.id;
            return (
              <ArtistTrackRow
                rank={index + 1}
                track={item}
                isResolving={video === 'pending'}
                isActive={isActive}
                isPlaying={isPlaying}
                onPress={() => handlePressTrack(item)}
              />
            );
          }}
          ListEmptyComponent={<EmptyView message="Aucun titre trouvé pour cet album." />}
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
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    list: {
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      paddingTop: 64,
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    cover: {
      width: 200,
      height: 200,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    coverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 16,
    },
    artistLink: {
      fontSize: 15,
      fontWeight: '600',
      marginTop: 6,
    },
    actionsRow: {
      marginTop: 16,
    },
    playButton: {
      width: PLAY_BUTTON_SIZE,
      height: PLAY_BUTTON_SIZE,
      borderRadius: PLAY_BUTTON_SIZE / 2,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    playButtonPressed: {
      opacity: 0.85,
    },
    playIcon: {
      marginLeft: 3,
    },
  });
}
