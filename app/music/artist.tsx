import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  getArtistAlbums,
  getArtistTopTracks,
  searchArtist,
  type DeezerAlbum,
  type DeezerArtist,
  type DeezerTrack,
} from '@/api/deezer';
import { toMusicTrack } from '@/api/musicMatch';
import { AlbumCard } from '@/components/AlbumCard';
import { ArtistTrackRow } from '@/components/ArtistTrackRow';
import { MiniPlayer } from '@/components/MiniPlayer';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useYoutubeResolution } from '@/hooks/useYoutubeResolution';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';
import { formatCount } from '@/utils/format';

type SearchParams = { artist: string };
type Status = 'loading' | 'error' | 'ready';

const TRACKS_LIMIT = 25;
const ALBUMS_LIMIT = 30;
const PLAY_BUTTON_SIZE = 58;

export default function ArtistScreen() {
  const { artist: artistName } = useLocalSearchParams<SearchParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currentTrack, isPlaying, shuffle, playTrack, toggleShuffle } = usePlayer();
  const { contentBottomPadding } = useBottomOffsets();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [artistInfo, setArtistInfo] = useState<DeezerArtist | null>(null);
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const { resolved, resolvedRef, resolveTrack } = useYoutubeResolution(tracks);

  const load = useCallback(async (name: string) => {
    setStatus('loading');
    setError(null);
    try {
      const artistResult = await searchArtist(name);
      if (!artistResult) {
        setError('Artiste introuvable.');
        setStatus('error');
        return;
      }
      const [topTracks, artistAlbums] = await Promise.all([
        getArtistTopTracks(artistResult.id, TRACKS_LIMIT),
        getArtistAlbums(artistResult.id, ALBUMS_LIMIT),
      ]);
      setArtistInfo(artistResult);
      setTracks(topTracks);
      setAlbums(artistAlbums);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (artistName) load(artistName);
  }, [artistName, load]);

  const openAlbum = useCallback(
    (album: DeezerAlbum) => {
      router.push({
        pathname: '/music/album',
        params: { albumId: String(album.id), title: album.title, coverUrl: album.coverUrl },
      });
    },
    [router],
  );

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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={24} color="#ffffff" />
      </Pressable>

      {status === 'loading' && <LoadingView label="Chargement de l'artiste..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => load(artistName)} />}
      {status === 'ready' && (
        <FlatList
          data={tracks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: contentBottomPadding }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.heroWrap}>
                {artistInfo?.pictureUrl ? (
                  <Image source={{ uri: artistInfo.pictureUrl }} style={styles.heroImage} contentFit="cover" />
                ) : (
                  <View style={[styles.heroImage, styles.heroPlaceholder]}>
                    <Ionicons name="person" size={72} color={colors.muted} />
                  </View>
                )}
                <LinearGradient
                  colors={['rgba(0,0,0,0.55)', 'transparent']}
                  style={styles.heroTopScrim}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={['transparent', colors.background]}
                  locations={[0.35, 1]}
                  style={styles.heroBottomGradient}
                  pointerEvents="none"
                />
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroKicker}>Artiste</Text>
                  <Text style={styles.heroName} numberOfLines={2}>
                    {artistInfo?.name ?? artistName}
                  </Text>
                  {artistInfo && artistInfo.fansCount >= 0 && (
                    <Text style={styles.heroFans}>{formatCount(artistInfo.fansCount)} auditeurs</Text>
                  )}
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable hitSlop={12} onPress={toggleShuffle} style={styles.shuffleButton}>
                  <Ionicons name="shuffle" size={26} color={shuffle ? colors.accent : colors.text} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={handlePlayAll}
                  disabled={tracks.length === 0}
                  style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
                >
                  <Ionicons name="play" size={26} color={colors.accentText} style={styles.playIcon} />
                </Pressable>
              </View>

              {albums.length > 0 && (
                <>
                  <Text style={[sharedStyles.text, styles.sectionLabel]}>Discographie</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.albumsList}
                  >
                    {albums.map((album) => (
                      <View key={album.id} style={styles.albumCardWrap}>
                        <AlbumCard album={album} onPress={() => openAlbum(album)} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

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
    backButton: {
      position: 'absolute',
      left: 12,
      zIndex: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    header: {
      marginBottom: 8,
    },
    heroWrap: {
      width: '100%',
      aspectRatio: 1.05,
      backgroundColor: colors.surface,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTopScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 120,
    },
    heroBottomGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '75%',
    },
    heroTextWrap: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 20,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    heroName: {
      color: '#ffffff',
      fontSize: 36,
      fontWeight: '800',
      lineHeight: 40,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    heroFans: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 6,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginTop: -(PLAY_BUTTON_SIZE / 2),
      marginBottom: 8,
    },
    shuffleButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
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
    sectionLabel: {
      fontSize: 20,
      fontWeight: '800',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    albumsList: {
      paddingHorizontal: 20,
    },
    albumCardWrap: {
      marginRight: 12,
    },
  });
}
