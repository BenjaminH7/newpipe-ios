// Feuille « Ajouter à une playlist » pour un lot de titres déjà résolus
// (sélection multiple dans la bibliothèque), là où SongMenu couvre le cas d'un
// seul YTSong venu d'un résultat de recherche. Créer une playlist depuis cette
// feuille la remplit directement avec la sélection.
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/music/BottomSheet';
import { PlaylistCover } from '@/components/music/PlaylistCover';
import { useLocalPlaylists } from '@/hooks/useMusicCollections';
import type { MusicTrack } from '@/storage/musicLibrary';
import { addTracksToLocalPlaylist, createLocalPlaylist } from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';

export function AddToPlaylistSheet({
  tracks,
  onClose,
  onAdded,
}: {
  /** `null` quand la feuille est fermée. */
  tracks: MusicTrack[] | null;
  onClose: () => void;
  /** Appelé après un ajout effectif, pour sortir du mode sélection. */
  onAdded?: (playlistName: string, count: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const playlists = useLocalPlaylists();
  const [newName, setNewName] = useState('');

  const close = useCallback(() => {
    setNewName('');
    onClose();
  }, [onClose]);

  const createAndAdd = useCallback(() => {
    if (!tracks || !newName.trim()) return;
    const name = newName.trim();
    createLocalPlaylist(name, tracks);
    onAdded?.(name, tracks.length);
    close();
  }, [tracks, newName, onAdded, close]);

  const addTo = useCallback(
    async (id: string, name: string) => {
      if (!tracks) return;
      const added = await addTracksToLocalPlaylist(id, tracks);
      if (added === 0) {
        Alert.alert(
          'Rien à ajouter',
          tracks.length > 1
            ? `Ces titres sont déjà dans « ${name} ».`
            : `Ce titre est déjà dans « ${name} ».`,
        );
        return;
      }
      onAdded?.(name, added);
      close();
    },
    [tracks, onAdded, close],
  );

  const count = tracks?.length ?? 0;

  return (
    <BottomSheet
      visible={tracks !== null}
      onClose={close}
      title="Ajouter à une playlist"
      subtitle={`${count} titre${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.newRow}>
          <View style={styles.newIcon}>
            <Ionicons name="add" size={22} color={colors.text} />
          </View>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nouvelle playlist..."
            placeholderTextColor={colors.muted}
            style={styles.newInput}
            returnKeyType="done"
            onSubmitEditing={createAndAdd}
          />
          <Pressable hitSlop={8} onPress={createAndAdd} accessibilityLabel="Créer la playlist">
            <Ionicons
              name="checkmark-circle"
              size={28}
              color={newName.trim() ? colors.accent : colors.border}
            />
          </Pressable>
        </View>

        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            onPress={() => addTo(playlist.id, playlist.name)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <PlaylistCover tracks={playlist.tracks} size={44} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {playlist.name}
              </Text>
              <Text style={styles.rowSubtitle}>
                {playlist.tracks.length} titre{playlist.tracks.length > 1 ? 's' : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    newRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    newIcon: {
      width: 44,
      height: 44,
      borderRadius: 4,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    newInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 12,
    },
  });
}
