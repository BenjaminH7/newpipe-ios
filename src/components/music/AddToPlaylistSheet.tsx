// Feuille « Ajouter à une playlist » pour un lot de titres déjà résolus
// (sélection multiple dans la bibliothèque), là où SongMenu couvre le cas d'un
// seul YTSong venu d'un résultat de recherche. Créer une playlist depuis cette
// feuille la remplit directement avec la sélection.
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const insets = useSafeAreaInsets();
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

  if (!tracks) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>Ajouter à une playlist</Text>
          <Text style={styles.subtitle}>
            {tracks.length} titre{tracks.length > 1 ? 's' : ''} sélectionné
            {tracks.length > 1 ? 's' : ''}
          </Text>
        </View>

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
              <View style={styles.rowIcon}>
                <Ionicons name="list" size={22} color={colors.muted} />
              </View>
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
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '75%',
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: {
      gap: 3,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13,
    },
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
    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: 4,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
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
