import { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicTrackItem } from '@/components/MusicTrackItem';
import { EmptyView } from '@/components/StatusView';
import { useMusicLibrary, useRemoveMusicTrack, useRetryMusicDownload } from '@/hooks/useMusicLibrary';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';

export default function MusicScreen() {
  const router = useRouter();
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
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher dans ta musique..."
          placeholderTextColor={colors.muted}
          style={[sharedStyles.input, styles.input]}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
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
    searchBar: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 4,
    },
    input: {
      fontSize: 15,
    },
    list: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
    },
  });
}
