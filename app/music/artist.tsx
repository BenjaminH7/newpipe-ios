import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { getArtistTopTracks, searchArtist, type DeezerArtist, type DeezerTrack } from '@/api/deezer';
import { resolveYoutubeTrack } from '@/api/musicMatch';
import type { VideoSummary } from '@/api/youtube';
import { ArtistTrackRow } from '@/components/ArtistTrackRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';
import { formatCount } from '@/utils/format';

type SearchParams = { artist: string };
type Status = 'loading' | 'error' | 'ready';
type Resolution = VideoSummary | null | 'pending';

const TRACKS_LIMIT = 25;
const RESOLVE_CONCURRENCY = 3;

function toMusicTrack(video: VideoSummary, track: DeezerTrack): MusicTrack {
  return {
    id: video.id,
    title: track.title,
    artist: track.artist,
    coverArtUrl: track.albumCoverUrl || video.thumbnail,
    duration: track.duration >= 0 ? track.duration : video.duration,
    addedAt: Date.now(),
    localUri: null,
    // N'est pas vraiment téléchargé : ce champ n'est consulté que par la
    // bibliothèque musicale (src/storage/musicLibrary.ts), jamais par la lecture.
    downloadStatus: 'downloaded',
  };
}

export default function ArtistScreen() {
  const { artist: artistName } = useLocalSearchParams<SearchParams>();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currentTrack, isPlaying, playTrack } = usePlayer();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [artistInfo, setArtistInfo] = useState<DeezerArtist | null>(null);
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [resolved, setResolved] = useState<Record<number, Resolution>>({});
  const resolvedRef = useRef(resolved);
  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  const load = useCallback(async (name: string) => {
    setStatus('loading');
    setError(null);
    setResolved({});
    try {
      const artistResult = await searchArtist(name);
      if (!artistResult) {
        setError('Artiste introuvable.');
        setStatus('error');
        return;
      }
      const topTracks = await getArtistTopTracks(artistResult.id, TRACKS_LIMIT);
      setArtistInfo(artistResult);
      setTracks(topTracks);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (artistName) load(artistName);
  }, [artistName, load]);

  // Résolution en tâche de fond (petits lots concurrents) des morceaux Deezer
  // vers leur équivalent YouTube jouable : la liste "propre" s'affiche tout de
  // suite, la lecture se prépare pendant ce temps sans bloquer l'écran.
  useEffect(() => {
    if (tracks.length === 0) return;
    let cancelled = false;
    let nextIndex = 0;

    async function worker() {
      while (!cancelled) {
        const i = nextIndex++;
        if (i >= tracks.length) return;
        const track = tracks[i];
        if (resolvedRef.current[track.id] !== undefined) continue;
        setResolved((prev) => ({ ...prev, [track.id]: 'pending' }));
        const match = await resolveYoutubeTrack(track.artist, track.title, track.duration);
        if (cancelled) return;
        setResolved((prev) => ({ ...prev, [track.id]: match }));
      }
    }

    for (let i = 0; i < RESOLVE_CONCURRENCY; i++) worker();
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const handlePressTrack = useCallback(
    async (track: DeezerTrack) => {
      let video = resolvedRef.current[track.id];
      if (!video || video === 'pending') {
        setResolved((prev) => ({ ...prev, [track.id]: 'pending' }));
        video = await resolveYoutubeTrack(track.artist, track.title, track.duration);
        setResolved((prev) => ({ ...prev, [track.id]: video }));
      }
      if (!video) return;

      const merged = { ...resolvedRef.current, [track.id]: video };
      const queue = tracks
        .map((t) => {
          const v = merged[t.id];
          return v && v !== 'pending' ? toMusicTrack(v, t) : null;
        })
        .filter((t): t is MusicTrack => t !== null);

      playTrack(toMusicTrack(video, track), queue);
    },
    [tracks, playTrack],
  );

  return (
    <View style={styles.container}>
      {status === 'loading' && <LoadingView label="Chargement de l'artiste..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => load(artistName)} />}
      {status === 'ready' && (
        <FlatList
          data={tracks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {artistInfo?.pictureUrl && (
                <Image source={{ uri: artistInfo.pictureUrl }} style={styles.headerImage} contentFit="cover" />
              )}
              <LinearGradient
                colors={['transparent', colors.background]}
                style={styles.headerGradient}
                pointerEvents="none"
              />
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerName} numberOfLines={2}>
                  {artistInfo?.name ?? artistName}
                </Text>
                {artistInfo && artistInfo.fansCount >= 0 && (
                  <Text style={styles.headerFans}>{formatCount(artistInfo.fansCount)} auditeurs</Text>
                )}
              </View>
              <Text style={[sharedStyles.text, styles.sectionLabel]}>Titres populaires</Text>
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
          ListEmptyComponent={<EmptyView message="Aucun titre trouvé pour cet artiste." />}
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
      paddingBottom: 24,
    },
    header: {
      marginBottom: 8,
    },
    headerImage: {
      width: '100%',
      aspectRatio: 1.15,
      backgroundColor: colors.surface,
    },
    headerGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '60%',
    },
    headerTextWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
    },
    headerName: {
      color: '#ffffff',
      fontSize: 34,
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    headerFans: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 18,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
    },
  });
}
