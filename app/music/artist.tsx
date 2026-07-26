// Page artiste YouTube Music (browseId UC...), calquée sur l'ArtistScreen de
// Metrolist : hero plein écran, boutons radio / aléatoire, titres populaires
// puis les étagères de la page (albums, singles, apparitions, artistes
// similaires) telles que YouTube Music les renvoie.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { findArtistByName, getArtistPage, getMusicQueue } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import { resizeThumbnail } from '@/api/ytmusic/parse';
import type { ArtistPageData, MusicSection, YTItem, YTSong } from '@/api/ytmusic/types';
import { albumsOfArtistPage } from '@/api/newReleases';
import { MiniPlayer } from '@/components/MiniPlayer';
import { SectionCarousel } from '@/components/music/SectionCarousel';
import { SongRow } from '@/components/music/SongRow';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useIsArtistFollowed, useToggleArtistFollow } from '@/hooks/useFollowedArtists';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

const PLAY_BUTTON_SIZE = 58;

export default function ArtistScreen() {
  // `browseId` est la voie normale ; `artist`/`name` couvre les entrées
  // héritées (historique, lecteur) où seul le nom est connu.
  const { browseId, name, artist } = useLocalSearchParams<{
    browseId?: string;
    name?: string;
    artist?: string;
  }>();
  const displayName = name || artist || '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack, playTrackRadio, toggleShuffle, shuffle } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<ArtistPageData | null>(null);
  const isFollowed = useIsArtistFollowed(page?.browseId ?? null);
  const toggleFollow = useToggleArtistFollow();

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const id = browseId || (displayName ? await findArtistByName(displayName) : null);
      if (!id) {
        setError('Artiste introuvable sur YouTube Music.');
        setStatus('error');
        return;
      }
      setPage(await getArtistPage(id));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, [browseId, displayName]);

  useEffect(() => {
    load();
  }, [load]);

  const playSong = useCallback(
    (song: YTSong, queue: YTSong[]) => {
      playTrack(songToTrack(song), songsToTracks(queue.length > 0 ? queue : [song]));
    },
    [playTrack],
  );

  // Bouton lecture : on suit l'endpoint officiel de la page artiste (même
  // sélection que music.youtube.com) et on retombe sur les titres populaires
  // affichés si YouTube Music n'en fournit pas.
  const playArtist = useCallback(
    async (endpointKind: 'shuffle' | 'radio') => {
      if (!page) return;
      const endpoint = endpointKind === 'radio' ? page.radioEndpoint : page.shuffleEndpoint;
      if (endpoint?.playlistId || endpoint?.videoId) {
        try {
          const queue = await getMusicQueue({
            videoId: endpoint.videoId ?? undefined,
            playlistId: endpoint.playlistId ?? undefined,
            params: endpoint.params ?? undefined,
          });
          if (queue.songs.length > 0) {
            // La radio d'artiste ne renvoie que ~50 titres et aucun automix :
            // sans le mode radio, la lecture s'arrêterait net au bout.
            playTrack(songToTrack(queue.songs[0]), songsToTracks(queue.songs), {
              radio: endpointKind === 'radio',
            });
            return;
          }
        } catch {
          // Repli sur les titres de la page ci-dessous.
        }
      }
      if (page.songs.length === 0) return;
      if (endpointKind === 'radio') {
        playTrackRadio(songToTrack(page.songs[0]));
        return;
      }
      playSong(page.songs[Math.floor(Math.random() * page.songs.length)], page.songs);
    },
    [page, playTrack, playTrackRadio, playSong],
  );

  const handleShuffle = useCallback(() => {
    if (!shuffle) toggleShuffle();
    playArtist('shuffle');
  }, [shuffle, toggleShuffle, playArtist]);

  const handleFollow = useCallback(() => {
    if (!page) return;
    toggleFollow(
      { id: page.browseId, name: page.name, pictureUrl: page.thumbnail || null },
      albumsOfArtistPage(page.sections).map((a) => a.browseId),
    );
  }, [page, toggleFollow]);

  const openMore = useCallback(
    (section: MusicSection) => {
      if (!section.moreBrowseId) return;
      router.push({
        pathname: '/music/browse',
        params: {
          browseId: section.moreBrowseId,
          params: section.moreParams ?? '',
          title: section.title,
        },
      });
    },
    [router],
  );

  const handleItem = useCallback(
    (item: YTItem) => {
      if (item.type === 'artist' && item.browseId === page?.browseId) return;
      openItem(item);
    },
    [openItem, page?.browseId],
  );

  return (
    <View style={styles.container}>
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={24} color="#ffffff" />
      </Pressable>

      {status === 'loading' && <LoadingView label={displayName || "Chargement de l'artiste..."} />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' && page && (
        <FlatList
          data={page.songs}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingBottom: contentBottomPadding }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.heroWrap}>
                {page.thumbnail ? (
                  <Image
                    source={{ uri: resizeThumbnail(page.thumbnail, 1000) }}
                    style={styles.heroImage}
                    contentFit="cover"
                  />
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
                    {page.name}
                  </Text>
                  {page.subscribers ? (
                    <Text style={styles.heroSubscribers}>{page.subscribers}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  hitSlop={8}
                  onPress={handleFollow}
                  style={({ pressed }) => [
                    styles.followButton,
                    isFollowed && styles.followButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={isFollowed ? 'notifications' : 'notifications-outline'}
                    size={16}
                    color={isFollowed ? colors.accent : colors.text}
                  />
                  <Text style={[styles.followLabel, isFollowed && { color: colors.accent }]}>
                    {isFollowed ? 'Suivi' : 'Suivre'}
                  </Text>
                </Pressable>

                <View style={styles.playControls}>
                  <Pressable hitSlop={12} onPress={() => playArtist('radio')} style={styles.iconButton}>
                    <Ionicons name="radio-outline" size={24} color={colors.text} />
                  </Pressable>
                  <Pressable hitSlop={12} onPress={handleShuffle} style={styles.iconButton}>
                    <Ionicons name="shuffle" size={26} color={shuffle ? colors.accent : colors.text} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => playArtist('shuffle')}
                    style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="play" size={26} color={colors.accentText} style={styles.playIcon} />
                  </Pressable>
                </View>
              </View>

              {page.songs.length > 0 && (
                <View style={styles.songsHeader}>
                  <Text style={styles.sectionTitle}>Titres populaires</Text>
                  {page.songsMoreBrowseId ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: '/music/browse',
                          params: { browseId: page.songsMoreBrowseId!, title: 'Titres' },
                        })
                      }
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.songRowWrap}>
              <SongRow
                song={item}
                isActive={item.id === currentTrack?.id}
                isPlaying={isPlaying}
                onPress={() => playSong(item, page.songs)}
                onMenu={() => showSongMenu(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            page.sections.length === 0 ? (
              <EmptyView message="Aucun contenu pour cet artiste." />
            ) : null
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {page.description ? (
                <View style={styles.aboutBlock}>
                  <Text style={styles.sectionTitle}>À propos</Text>
                  <Text style={styles.aboutText}>{page.description}</Text>
                </View>
              ) : null}
              {page.sections.map((section, index) => (
                <SectionCarousel
                  key={`${section.title}-${index}`}
                  section={section}
                  currentTrackId={currentTrack?.id}
                  isPlaying={isPlaying}
                  onItemPress={handleItem}
                  onSongPress={playSong}
                  onSongMenu={showSongMenu}
                  onMore={section.moreBrowseId ? () => openMore(section) : undefined}
                />
              ))}
            </View>
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
    pressed: {
      opacity: 0.75,
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
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    heroName: {
      color: '#ffffff',
      fontSize: 42,
      fontWeight: '900',
      lineHeight: 46,
      letterSpacing: -1.2,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    heroSubscribers: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 6,
    },
    // Pilule "Suivre" à gauche, radio/aléatoire/lecture à droite, comme sur les
    // pages artiste de YouTube Music — le bouton play chevauche le bas du hero.
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginTop: -(PLAY_BUTTON_SIZE / 2),
      marginBottom: 8,
    },
    playControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    followButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.muted,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    followButtonActive: {
      borderColor: colors.accent,
    },
    followLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    iconButton: {
      width: 40,
      height: 40,
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
    playIcon: {
      marginLeft: 3,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    songsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    songRowWrap: {
      paddingHorizontal: 20,
    },
    footer: {
      paddingTop: 24,
    },
    aboutBlock: {
      paddingHorizontal: 20,
      paddingBottom: 26,
      gap: 10,
    },
    aboutText: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
    },
  });
}
