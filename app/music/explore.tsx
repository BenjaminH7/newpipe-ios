// Explorer, repris de l'ExploreScreen de Metrolist : nouveautés du catalogue
// (FEmusic_new_releases_albums), classements (FEmusic_charts) et pastilles
// d'ambiances & genres (FEmusic_moods_and_genres).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { getCharts, getMoodAndGenres, getNewReleaseAlbums } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { MoodSection, MusicSection, YTAlbum, YTItem, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { SectionCarousel, SectionHeader } from '@/components/music/SectionCarousel';
import { useSongMenu } from '@/components/music/SongMenu';
import { ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [newReleases, setNewReleases] = useState<YTAlbum[]>([]);
  const [charts, setCharts] = useState<MusicSection[]>([]);
  const [moods, setMoods] = useState<MoodSection[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      // Les trois blocs sont indépendants : un échec (ex. charts indisponibles
      // dans le pays) ne doit pas vider la page entière.
      const [releasesResult, chartsResult, moodsResult] = await Promise.allSettled([
        getNewReleaseAlbums(),
        getCharts(),
        getMoodAndGenres(),
      ]);
      const releases = releasesResult.status === 'fulfilled' ? releasesResult.value : [];
      const chartSections = chartsResult.status === 'fulfilled' ? chartsResult.value : [];
      const moodSections = moodsResult.status === 'fulfilled' ? moodsResult.value : [];
      if (releases.length === 0 && chartSections.length === 0 && moodSections.length === 0) {
        throw new Error('Explorer est indisponible pour le moment.');
      }
      setNewReleases(releases);
      setCharts(chartSections);
      setMoods(moodSections);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const playSong = useCallback(
    (song: YTSong, queue: YTSong[]) => {
      playTrack(songToTrack(song), songsToTracks(queue.length > 0 ? queue : [song]));
    },
    [playTrack],
  );

  const handleItem = useCallback((item: YTItem) => openItem(item), [openItem]);

  const releasesSection: MusicSection | null =
    newReleases.length > 0
      ? {
          title: 'Nouveaux albums',
          subtitle: null,
          items: newReleases,
          moreBrowseId: null,
          moreParams: null,
        }
      : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Explorer' }} />
      {status === 'loading' && <LoadingView label="Chargement..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {releasesSection && (
            <SectionCarousel
              section={releasesSection}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              onItemPress={handleItem}
              onSongPress={playSong}
              onSongMenu={showSongMenu}
            />
          )}

          {charts.map((section, index) => (
            <SectionCarousel
              key={`chart-${index}`}
              section={section}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              onItemPress={handleItem}
              onSongPress={playSong}
              onSongMenu={showSongMenu}
            />
          ))}

          {moods.map((section, index) => (
            <View key={`mood-${index}`} style={styles.moodSection}>
              <SectionHeader title={section.title} />
              <View style={styles.moodGrid}>
                {section.categories.map((category) => (
                  <Pressable
                    key={category.browseId + category.title}
                    onPress={() =>
                      router.push({
                        pathname: '/music/mood',
                        params: {
                          browseId: category.browseId,
                          params: category.params ?? '',
                          title: category.title,
                        },
                      })
                    }
                    style={({ pressed }) => [styles.moodChip, pressed && styles.pressed]}
                  >
                    <View
                      style={[styles.moodStripe, { backgroundColor: category.color ?? colors.accent }]}
                    />
                    <Text style={styles.moodLabel} numberOfLines={2}>
                      {category.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
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
    content: {
      paddingTop: 16,
    },
    pressed: {
      opacity: 0.6,
    },
    moodSection: {
      marginBottom: 26,
    },
    moodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 20,
    },
    // Pastille avec liseré coloré à gauche, comme les catégories d'ambiance de
    // YouTube Music (la couleur vient de l'API).
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%',
      minHeight: 56,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    moodStripe: {
      width: 5,
      alignSelf: 'stretch',
    },
    moodLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  });
}
