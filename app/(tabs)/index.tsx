// Accueil YouTube Music, calqué sur le HomeScreen de Metrolist : chips de
// filtrage, carrousels personnalisés servis par InnerTube (FEmusic_home) et
// raccourcis vers la bibliothèque. Le contenu vient du catalogue en ligne, la
// lecture passe par le lecteur global de l'app.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMusicHome } from '@/api/ytmusic/client';
import { songToTrack, songsToTracks } from '@/api/ytmusic/convert';
import type { HomeChip, MusicHomePage, MusicSection, YTItem, YTSong } from '@/api/ytmusic/types';
import { MiniPlayer } from '@/components/MiniPlayer';
import { SectionCarousel } from '@/components/music/SectionCarousel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicNavigation } from '@/hooks/useMusicNavigation';
import { useSongMenu } from '@/components/music/SongMenu';
import { useUnseenReleasesCount } from '@/hooks/useReleasesFeed';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'loading' | 'error' | 'ready';

export default function MusicHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { openItem } = useMusicNavigation();
  const { showSongMenu } = useSongMenu();
  const unseenReleases = useUnseenReleasesCount();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<MusicHomePage | null>(null);
  // Les chips vivent hors de `page` : une page filtrée peut en renvoyer moins
  // (ou aucun), et la barre ne doit jamais disparaître — sinon impossible de
  // revenir à "Tout" une fois un filtre appliqué.
  const [chips, setChips] = useState<HomeChip[]>([]);
  const [activeChip, setActiveChip] = useState<HomeChip | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Changement de chip : le feed déjà affiché reste à l'écran sous un voile le
  // temps de la requête, au lieu de laisser un écran blanc à chaque filtre.
  const [switchingChip, setSwitchingChip] = useState(false);

  // Jeton anti-course : deux chips enchaînés peuvent revenir dans le désordre.
  const requestRef = useRef(0);

  const load = useCallback(async (chip: HomeChip | null, keepContent = false) => {
    const token = ++requestRef.current;
    if (keepContent) setSwitchingChip(true);
    else setStatus('loading');
    setError(null);
    try {
      const result = await getMusicHome(chip ? { params: chip.params } : undefined);
      if (requestRef.current !== token) return;
      setPage(result);
      if (result.chips.length > 0) setChips(result.chips);
      setStatus('ready');
    } catch (e) {
      if (requestRef.current !== token) return;
      setError(e instanceof Error ? e.message : 'Impossible de charger l’accueil.');
      setStatus('error');
    } finally {
      if (requestRef.current === token) setSwitchingChip(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const token = ++requestRef.current;
    try {
      const result = await getMusicHome(activeChip ? { params: activeChip.params } : undefined);
      if (requestRef.current !== token) return;
      setPage(result);
      if (result.chips.length > 0) setChips(result.chips);
      setStatus('ready');
    } catch {
      // Rafraîchissement best-effort : on garde le contenu déjà affiché.
    } finally {
      setRefreshing(false);
    }
  }, [activeChip]);

  // Les carrousels suivants arrivent par continuation, comme le scroll infini
  // de music.youtube.com.
  const loadMore = useCallback(async () => {
    if (!page?.continuation || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getMusicHome({ continuation: page.continuation });
      setPage((prev) =>
        prev
          ? { ...prev, sections: [...prev.sections, ...next.sections], continuation: next.continuation }
          : next,
      );
    } catch {
      setPage((prev) => (prev ? { ...prev, continuation: null } : prev));
    } finally {
      setLoadingMore(false);
    }
  }, [page?.continuation, loadingMore]);

  // Re-toucher le chip actif le désélectionne, comme sur music.youtube.com.
  const selectChip = useCallback(
    (chip: HomeChip | null) => {
      const next = chip && chip.params === activeChip?.params ? null : chip;
      setActiveChip(next);
      load(next, true);
    },
    [activeChip, load],
  );

  const playSong = useCallback(
    (song: YTSong, queue: YTSong[]) => {
      playTrack(songToTrack(song), songsToTracks(queue.length > 0 ? queue : [song]));
    },
    [playTrack],
  );

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

  const handleItem = useCallback((item: YTItem) => openItem(item), [openItem]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Accueil"
        right={
          // Explorer a rejoint l'écran de recherche (« Parcourir tout »), ce qui
          // libère la place des Réglages — jusqu'ici sans aucun point d'entrée.
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/music/releases')}
              hitSlop={8}
              accessibilityLabel="Nouveautés"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="notifications-outline" size={25} color={colors.text} />
              {unseenReleases > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unseenReleases > 9 ? '9+' : unseenReleases}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push('/history')}
              hitSlop={8}
              accessibilityLabel="Historique"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="time-outline" size={25} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityLabel="Réglages"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="settings-outline" size={25} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      {/* Seule entrée de recherche de l'app depuis la suppression de l'onglet
          Rechercher : un champ factice qui ouvre l'écran de recherche (titres,
          vidéos YouTube, albums, artistes, playlists). */}
      <Pressable
        onPress={() => router.push('/music/search')}
        accessibilityRole="search"
        accessibilityLabel="Rechercher"
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
      >
        <Ionicons name="search" size={20} color={colors.muted} />
        <Text style={styles.searchPlaceholder} numberOfLines={1}>
          Titres, vidéos, artistes, albums...
        </Text>
      </Pressable>

      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          <Chip label="Tout" active={activeChip === null} onPress={() => selectChip(null)} />
          {chips.map((chip) => (
            <Chip
              key={chip.params}
              label={chip.title}
              active={activeChip?.params === chip.params}
              onPress={() => selectChip(chip)}
            />
          ))}
        </ScrollView>
      )}

      {status === 'loading' && <LoadingView label="Chargement de YouTube Music..." />}
      {status === 'error' && <ErrorView message={error ?? ''} onRetry={() => load(activeChip)} />}
      {status === 'ready' && page?.sections.length === 0 && (
        <EmptyView
          icon="albums-outline"
          title="Rien à afficher"
          message={
            activeChip
              ? `Aucun contenu pour « ${activeChip.title} ». Reviens sur "Tout" pour l’accueil complet.`
              : 'L’accueil YouTube Music n’a rien renvoyé. Réessaie dans un instant.'
          }
        />
      )}
      {status === 'ready' && page && page.sections.length > 0 && (
        <View style={styles.feed}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.muted} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) loadMore();
          }}
          scrollEventThrottle={200}
        >
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
          {loadingMore && <ActivityIndicator color={colors.muted} style={styles.moreLoader} />}
        </ScrollView>
        {switchingChip && (
          <View style={styles.switchOverlay}>
            <ActivityIndicator color={colors.text} />
          </View>
        )}
        </View>
      )}

      <MiniPlayer />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
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
      opacity: 0.7,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: colors.accentText,
      fontSize: 10,
      fontWeight: '800',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 20,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    searchPlaceholder: {
      flex: 1,
      color: colors.muted,
      fontSize: 15,
      fontWeight: '500',
    },
    chipsScroll: {
      flexGrow: 0,
      marginBottom: 4,
    },
    chipsRow: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.text,
    },
    chipLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    chipLabelActive: {
      color: colors.background,
    },
    feed: {
      flex: 1,
    },
    // Voile posé sur le feed pendant un changement de chip : il masque à moitié
    // le contenu périmé et absorbe les touches, sans faire disparaître la page.
    switchOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      opacity: 0.6,
    },
    scrollContent: {
      paddingTop: 10,
    },
    moreLoader: {
      marginVertical: 20,
    },
  });
}
