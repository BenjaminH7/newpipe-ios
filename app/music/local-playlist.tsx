// Playlist créée dans l'app : lecture, réordonnancement et suppression de
// titres, renommage — l'équivalent local du LocalPlaylistScreen de Metrolist.
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MiniPlayer } from '@/components/MiniPlayer';
import { EmptyView, LoadingView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useLocalPlaylist } from '@/hooks/useMusicCollections';
import { usePlayer } from '@/player/PlayerContext';
import {
  deleteLocalPlaylist,
  moveTrackInLocalPlaylist,
  removeTrackFromLocalPlaylist,
  renameLocalPlaylist,
} from '@/storage/musicCollections';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';

export default function LocalPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const { currentTrack, isPlaying, playTrack, toggleShuffle, shuffle } = usePlayer();
  const { playlist, loading } = useLocalPlaylist(id ?? null);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  const playAll = useCallback(() => {
    if (playlist && playlist.tracks.length > 0) playTrack(playlist.tracks[0], playlist.tracks);
  }, [playlist, playTrack]);

  const shuffleAll = useCallback(() => {
    if (!playlist || playlist.tracks.length === 0) return;
    if (!shuffle) toggleShuffle();
    const random = playlist.tracks[Math.floor(Math.random() * playlist.tracks.length)];
    playTrack(random, playlist.tracks);
  }, [playlist, playTrack, shuffle, toggleShuffle]);

  const confirmDelete = useCallback(() => {
    if (!playlist) return;
    Alert.alert('Supprimer la playlist ?', `« ${playlist.name} » sera supprimée définitivement.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteLocalPlaylist(playlist.id);
          router.back();
        },
      },
    ]);
  }, [playlist, router]);

  const commitRename = useCallback(() => {
    if (!playlist) return;
    renameLocalPlaylist(playlist.id, name);
    setRenaming(false);
  }, [playlist, name]);

  if (!playlist) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Playlist' }} />
        {loading ? <LoadingView /> : <EmptyView message="Cette playlist n’existe plus." />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: playlist.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                hitSlop={8}
                accessibilityLabel="Renommer la playlist"
                onPress={() => {
                  setName(playlist.name);
                  setRenaming(true);
                }}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable hitSlop={8} accessibilityLabel="Supprimer la playlist" onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />

      {renaming && (
        <View style={styles.renameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.renameInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commitRename}
          />
          <Pressable hitSlop={8} onPress={commitRename} accessibilityLabel="Valider le nom">
            <Ionicons name="checkmark-circle" size={30} color={colors.accent} />
          </Pressable>
        </View>
      )}

      <FlatList
        data={playlist.tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          playlist.tracks.length > 0 ? (
            <View style={styles.actionsRow}>
              <Text style={styles.count}>
                {playlist.tracks.length} titre{playlist.tracks.length > 1 ? 's' : ''}
              </Text>
              <View style={styles.actionButtons}>
                <Pressable hitSlop={10} onPress={shuffleAll} style={styles.iconButton}>
                  <Ionicons name="shuffle" size={24} color={shuffle ? colors.accent : colors.text} />
                </Pressable>
                <Pressable
                  onPress={playAll}
                  style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
                >
                  <Ionicons name="play" size={24} color={colors.accentText} style={styles.playIcon} />
                </Pressable>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyView
            icon="list-outline"
            title="Playlist vide"
            message="Ajoute des titres depuis leur menu « Ajouter à une playlist »."
          />
        }
        renderItem={({ item, index }) => {
          const isActive = currentTrack?.id === item.id;
          const isFirst = index === 0;
          const isLast = index === playlist.tracks.length - 1;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => playTrack(item, playlist.tracks)}
            >
              <View>
                <Image
                  source={{ uri: item.coverArtUrl }}
                  style={[styles.cover, sharedStyles.coverSmall]}
                  contentFit="cover"
                />
                {/* Même repère de lecture que SongRow et la file d'attente :
                    un voile sur la pochette plutôt qu'un préfixe textuel. */}
                {isActive && (
                  <View style={styles.coverOverlay}>
                    <Ionicons name={isPlaying ? 'volume-high' : 'pause'} size={18} color="#ffffff" />
                  </View>
                )}
              </View>
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowTitle, isActive && { color: colors.accent }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.artist}
                  {item.duration >= 0 ? ` • ${formatDuration(item.duration)}` : ''}
                </Text>
              </View>
              <Pressable
                hitSlop={6}
                disabled={isFirst}
                accessibilityLabel={`Monter ${item.title}`}
                onPress={() => moveTrackInLocalPlaylist(playlist.id, item.id, -1)}
                style={styles.moveButton}
              >
                <Ionicons name="chevron-up" size={18} color={isFirst ? colors.border : colors.muted} />
              </Pressable>
              <Pressable
                hitSlop={6}
                disabled={isLast}
                accessibilityLabel={`Descendre ${item.title}`}
                onPress={() => moveTrackInLocalPlaylist(playlist.id, item.id, 1)}
                style={styles.moveButton}
              >
                <Ionicons name="chevron-down" size={18} color={isLast ? colors.border : colors.muted} />
              </Pressable>
              <Pressable
                hitSlop={6}
                accessibilityLabel={`Retirer ${item.title} de la playlist`}
                onPress={() => removeTrackFromLocalPlaylist(playlist.id, item.id)}
                style={styles.moveButton}
              >
                <Ionicons name="remove-circle-outline" size={20} color={colors.muted} />
              </Pressable>
            </Pressable>
          );
        }}
      />
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
    pressed: {
      opacity: 0.7,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 18,
    },
    renameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    renameInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
    },
    count: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playIcon: {
      marginLeft: 3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    cover: {
      width: 48,
      height: 48,
    },
    coverOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 4,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    moveButton: {
      width: 26,
      alignItems: 'center',
    },
  });
}
