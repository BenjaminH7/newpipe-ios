import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyView } from '@/components/StatusView';
import { HistoryItem } from '@/components/HistoryItem';
import { MiniPlayer } from '@/components/MiniPlayer';
import { useClearHistory, useHistory, useRemoveHistoryEntry } from '@/hooks/useHistory';
import { usePlayer } from '@/player/PlayerContext';
import type { HistoryEntry } from '@/storage/history';
import { useTheme, type ColorPalette } from '@/theme';

function entryId(entry: HistoryEntry): string {
  return entry.kind === 'video' ? entry.video.id : entry.track.id;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const entries = useHistory();
  const removeEntry = useRemoveHistoryEntry();
  const clearAll = useClearHistory();
  const { playTrack } = usePlayer();

  const confirmClearAll = () => {
    Alert.alert("Effacer tout l'historique ?", 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: clearAll },
    ]);
  };

  const openEntry = (entry: HistoryEntry) => {
    if (entry.kind === 'video') {
      const v = entry.video;
      router.push({
        pathname: '/video/[id]',
        params: {
          id: v.id,
          title: v.title,
          thumbnail: v.thumbnail,
          channelId: v.channelId ?? '',
          channelName: v.channelName,
          channelAvatar: v.channelAvatar ?? '',
          uploadedDate: v.uploadedDate ?? '',
          views: String(v.views),
          duration: String(v.duration),
        },
      });
    } else {
      playTrack(entry.track, [entry.track]);
    }
  };

  return (
    <View style={styles.container}>
      {entries.length === 0 ? (
        <EmptyView message="Aucun historique pour l'instant. Les vidéos regardées et les musiques écoutées apparaîtront ici." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.kind}:${entryId(item)}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable onPress={confirmClearAll} style={styles.clearButton} hitSlop={8}>
              <Text style={styles.clearButtonText}>Tout effacer</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <HistoryItem
              entry={item}
              onPress={() => openEntry(item)}
              onRemove={() => removeEntry(item.kind, entryId(item))}
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
    list: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 24,
    },
    clearButton: {
      alignSelf: 'flex-end',
      paddingVertical: 8,
    },
    clearButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
