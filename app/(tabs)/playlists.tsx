import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoListItem } from '@/components/VideoListItem';
import { EmptyView } from '@/components/StatusView';
import { MiniPlayer } from '@/components/MiniPlayer';
import { useSavedVideos } from '@/hooks/useSavedVideos';
import { useTheme, type ColorPalette } from '@/theme';

export default function PlaylistsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const videos = useSavedVideos();

  return (
    <View style={styles.container}>
      {videos.length === 0 ? (
        <EmptyView message="Aucune vidéo enregistrée. Appuie sur l'icône signet d'une vidéo pour la regarder plus tard." />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <VideoListItem
              video={item}
              onPress={() =>
                router.push({
                  pathname: '/video/[id]',
                  params: {
                    id: item.id,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    channelId: item.channelId ?? '',
                    channelName: item.channelName,
                    channelAvatar: item.channelAvatar ?? '',
                    uploadedDate: item.uploadedDate ?? '',
                    views: String(item.views),
                    duration: String(item.duration),
                  },
                })
              }
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
      paddingTop: 12,
      paddingBottom: 24,
    },
  });
}
