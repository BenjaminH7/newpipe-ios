import { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicTrackItem } from '@/components/MusicTrackItem';
import { EmptyView } from '@/components/StatusView';
import { useMusicLibrary, useRemoveMusicTrack, useRetryMusicDownload } from '@/hooks/useMusicLibrary';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';

export default function MusicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tracks = useMusicLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const removeTrack = useRemoveMusicTrack();
  const retryDownload = useRetryMusicDownload();
  const [query, setQuery] = useState('');

  const openArtist = (artist: string) => {
    router.push({ pathname: '/music/artist', params: { artist } });
  };

  const confirmRemoveTrack = (track: MusicTrack) => {
    Alert.alert(
      'Supprimer ce titre ?',
      `Veux-tu vraiment supprimer "${track.title}" de ta bibliothèque musicale ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeTrack(track.id) },
      ],
    );
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
      <View style={[styles.topHeader, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Musique</Text>
        {tracks.length > 0 && (
          <Text style={sharedStyles.mutedText}>
            {tracks.length} titre{tracks.length > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher dans ta musique..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {tracks.length === 0 ? (
        <EmptyView message="Aucune musique. Appuie sur l'icône note de musique d'une vidéo pour l'ajouter et l'écouter hors-ligne." />
      ) : filtered.length === 0 ? (
        <EmptyView message="Aucun résultat." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MusicTrackItem
              track={item}
              isActive={currentTrack?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playTrack(item, filtered)}
              onArtistPress={() => openArtist(item.artist)}
              onRemove={() => confirmRemoveTrack(item)}
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
    topHeader: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '800',
    },
    searchBar: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 14,
    },
    searchIcon: {
      marginRight: 8,
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
      paddingBottom: 12,
    },
  });
}
