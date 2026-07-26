// Sélecteur « Ajouter des titres » ouvert depuis une playlist locale : la
// bibliothèque musicale entière, filtrable, avec cases à cocher — le pendant
// de l'écran « Ajouter à cette playlist » de Spotify. AddToPlaylistSheet fait
// l'inverse (des titres déjà choisis vers une playlist à désigner).
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BottomSheet } from '@/components/music/BottomSheet';
import { useMusicLibrary } from '@/hooks/useMusicLibrary';
import { addTracksToLocalPlaylist } from '@/storage/musicCollections';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';

export function AddTracksSheet({
  playlistId,
  existingIds,
  onClose,
  onAdded,
}: {
  /** `null` quand la feuille est fermée. */
  playlistId: string | null;
  /** Titres déjà dans la playlist : affichés cochés et non sélectionnables. */
  existingIds: string[];
  onClose: () => void;
  onAdded?: (count: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const library = useMusicLibrary();
  const [query, setQuery] = useState('');
  // Ordre de sélection = ordre d'ajout dans la playlist.
  const [selected, setSelected] = useState<string[]>([]);

  const alreadyIn = useMemo(() => new Set(existingIds), [existingIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [library, query]);

  const close = useCallback(() => {
    setQuery('');
    setSelected([]);
    onClose();
  }, [onClose]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const confirm = useCallback(async () => {
    if (!playlistId || selected.length === 0) return;
    const tracks = selected
      .map((id) => library.find((t) => t.id === id))
      .filter((t): t is MusicTrack => t !== undefined);
    const added = await addTracksToLocalPlaylist(playlistId, tracks);
    onAdded?.(added);
    close();
  }, [playlistId, selected, library, onAdded, close]);

  const addable = results.filter((t) => !alreadyIn.has(t.id));
  const allSelected = addable.length > 0 && addable.every((t) => selected.includes(t.id));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? [] : addable.map((t) => t.id));
    // `addable` est recalculé à chaque rendu : le dépendre explicitement
    // éviterait une closure périmée mais invaliderait le callback à chaque
    // frappe — ici la liste vient du rendu courant, c'est ce qu'on veut.
  }, [allSelected, addable]);

  return (
    <BottomSheet
      visible={playlistId !== null}
      onClose={close}
      height="85%"
      header={
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Ajouter des titres</Text>
            {addable.length > 0 && (
              <Pressable hitSlop={8} onPress={toggleAll}>
                <Text style={styles.action}>{allSelected ? 'Aucun' : 'Tout'}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Chercher dans ta bibliothèque"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      }
      footer={
        <Pressable
          disabled={selected.length === 0}
          onPress={confirm}
          style={({ pressed }) => [
            styles.confirmButton,
            selected.length === 0 && styles.confirmDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.confirmLabel}>
            {selected.length === 0
              ? 'Sélectionne des titres'
              : `Ajouter ${selected.length} titre${selected.length > 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      }
    >
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {library.length === 0
              ? 'Ta bibliothèque est vide : like des titres pour pouvoir les ajouter ici.'
              : 'Aucun titre ne correspond.'}
          </Text>
        }
        renderItem={({ item }) => {
          const inPlaylist = alreadyIn.has(item.id);
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              disabled={inPlaylist}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons
                name={inPlaylist || isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={inPlaylist ? colors.muted : isSelected ? colors.accent : colors.muted}
              />
              <Image source={{ uri: item.coverArtUrl }} style={styles.cover} contentFit="cover" />
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowTitle, inPlaylist && styles.dimmed]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {inPlaylist
                    ? 'Déjà dans la playlist'
                    : `${item.artist}${item.duration >= 0 ? ` • ${formatDuration(item.duration)}` : ''}`}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    header: {
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    action: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 10,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 7,
    },
    pressed: {
      opacity: 0.6,
    },
    cover: {
      width: 46,
      height: 46,
      borderRadius: 4,
      backgroundColor: colors.surface,
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
    dimmed: {
      color: colors.muted,
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 12,
    },
    empty: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 30,
      paddingVertical: 40,
    },
    confirmButton: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      marginHorizontal: 20,
      marginTop: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    confirmDisabled: {
      opacity: 0.4,
    },
    confirmLabel: {
      color: colors.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
