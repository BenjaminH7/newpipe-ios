// Page d'une ambiance ou d'un genre (« Détente », « Hip-Hop »...) : les
// sections de playlists que YouTube Music renvoie pour cette catégorie, comme
// le MoodAndGenresScreen de Metrolist.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getMoodPage } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { MusicSection, YTItem, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { SectionCarousel } from '@/components/music/SectionCarousel';
import { useSongMenu } from '@/components/music/SongMenu';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

export default function MoodScreen() {
  const { browseId, params, title } = useLocalSearchParams<{
    browseId: string;
    params?: string;
    title?: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<MusicSection[]>([]);
  const [pageTitle, setPageTitle] = useState(title ?? '');

  const load = useCallback(async () => {
    if (!browseId) return;
    setStatus('loading');
    setError(null);
    try {
      const page = await getMoodPage(browseId, params || undefined);
      setSections(page.sections);
      if (page.title) setPageTitle(page.title);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger cette catégorie.');
      setStatus('error');
    }
  }, [browseId, params]);

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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: pageTitle || 'Ambiances' }} />
      {status === 'loading' && <LoadingView />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={load} />}
      {status === 'ready' &&
        (sections.length === 0 ? (
          <EmptyView message="Rien à afficher dans cette catégorie." />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, index) => (
              <SectionCarousel
                key={`${section.title}-${index}`}
                section={section}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onItemPress={handleItem}
                onSongPress={playSong}
                onSongMenu={showSongMenu}
              />
            ))}
          </ScrollView>
        ))}
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
  });
}
