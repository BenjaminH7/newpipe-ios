import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicTrackItem } from '@/components/MusicTrackItem';
import { EmptyView } from '@/components/StatusView';
import { useMusicLibrary, useRemoveMusicTrack, useRetryMusicDownload } from '@/hooks/useMusicLibrary';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';

export default function MusicScreen() {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tracks = useMusicLibrary();
  const { playTrack } = usePlayer();
  const removeTrack = useRemoveMusicTrack();
  const retryDownload = useRetryMusicDownload();
  const [query, setQuery] = useState('');

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
              onPress={() => playTrack(item, filtered)}
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
