import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { EmptyView } from '@/components/StatusView';
import { HistoryItem } from '@/components/HistoryItem';
import { MiniPlayer } from '@/components/MiniPlayer';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
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
  const { contentBottomPadding } = useBottomOffsets();

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
      <Stack.Screen
        options={{
          headerRight:
            entries.length > 0
              ? () => (
                  <Pressable onPress={confirmClearAll} hitSlop={8}>
                    <Text style={styles.clearButtonText}>Tout effacer</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />
      {entries.length === 0 ? (
        <EmptyView
          icon="time-outline"
          title="Aucun historique"
          message="Les vidéos regardées et les musiques écoutées apparaîtront ici."
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.kind}:${entryId(item)}`}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
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
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    clearButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
