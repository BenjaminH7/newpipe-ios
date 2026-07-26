import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicTrackItem } from '@/components/MusicTrackItem';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useMusicLibrary, useRemoveMusicTrack, useRetryMusicDownload } from '@/hooks/useMusicLibrary';
import { useUnseenReleasesCount } from '@/hooks/useReleasesFeed';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

export default function MusicScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tracks = useMusicLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const removeTrack = useRemoveMusicTrack();
  const retryDownload = useRetryMusicDownload();
  const { contentBottomPadding } = useBottomOffsets();
  const [query, setQuery] = useState('');
  const unseenReleases = useUnseenReleasesCount();

  const openArtist = (artist: string) => {
    router.push({ pathname: '/music/artist', params: { artist } });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [tracks, query]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Musique"
        subtitle={
          tracks.length > 0 ? `${tracks.length} titre${tracks.length > 1 ? 's' : ''}` : undefined
        }
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/music/releases')}
              hitSlop={8}
              accessibilityLabel="Nouveautés"
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Ionicons name="notifications-outline" size={26} color={colors.text} />
              {unseenReleases > 0 && (
                <View style={styles.releasesBadge}>
                  <Text style={styles.releasesBadgeText}>
                    {unseenReleases > 9 ? '9+' : unseenReleases}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push('/history')}
              hitSlop={8}
              accessibilityLabel="Historique"
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Ionicons name="time-outline" size={26} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {tracks.length === 0 ? (
        <EmptyView
          icon="musical-notes-outline"
          title="Ta bibliothèque est vide"
          message="Appuie sur l'icône note de musique d'une vidéo pour l'ajouter et l'écouter hors-ligne."
        />
      ) : filtered.length === 0 ? (
        <EmptyView message="Aucun résultat." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MusicTrackItem
              track={item}
              isActive={currentTrack?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playTrack(item, filtered)}
              onArtistPress={() => openArtist(item.artist)}
              onRemove={() => removeTrack(item.id)}
              onRetryDownload={() => retryDownload(item.id)}
            />
          )}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
    },
    // Pastille de compteur sur la cloche : nombre de sorties pas encore vues.
    releasesBadge: {
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
    releasesBadgeText: {
      color: colors.accentText,
      fontSize: 10,
      fontWeight: '800',
    },
    searchBar: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    // Champ de recherche façon Spotify : rectangle arrondi (pas de pilule),
    // un peu plus haut, texte plus affirmé.
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      paddingVertical: 12,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
  });
}
