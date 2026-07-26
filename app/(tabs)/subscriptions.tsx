import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { getChannelUploads } from '@/api/youtube';
import type { VideoSummary } from '@/api/youtube';
import { VideoListItem } from '@/components/VideoListItem';
import { EmptyView, ErrorView, LoadingView } from '@/components/StatusView';
import { useSubscriptions, useToggleChannelSubscription } from '@/hooks/useSubscriptions';
import type { SubscribedChannel } from '@/storage/subscriptions';
import { useTheme, type ColorPalette } from '@/theme';

// Mélange les nouveautés de chaque chaîne au lieu de les concaténer : sans date
// exacte comparable entre chaînes (YouTube ne fournit que du texte relatif), un
// tourniquet donne un flux plus proche d'un vrai fil d'actualité qu'un
// enchaînement chaîne par chaîne.
function interleave(lists: VideoSummary[][]): VideoSummary[] {
  const out: VideoSummary[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}

type Status = 'loading' | 'error' | 'ready';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const channels = useSubscriptions();
  const toggleSubscription = useToggleChannelSubscription();
  const [status, setStatus] = useState<Status>('loading');
  const [feed, setFeed] = useState<VideoSummary[]>([]);

  const loadFeed = useCallback(async (subs: SubscribedChannel[]) => {
    if (subs.length === 0) {
      setFeed([]);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const results = await Promise.allSettled(subs.map((c) => getChannelUploads(c.id)));
      const lists = results.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value.items.map((v) => ({
              ...v,
              channelId: subs[i].id,
              channelName: subs[i].name,
              channelAvatar: subs[i].avatar,
            }))
          : []
      );
      setFeed(interleave(lists));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadFeed(channels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  return (
    <View style={styles.container}>
      {channels.length === 0 ? (
        <EmptyView message="Aucun abonnement. Abonne-toi à une chaîne depuis une vidéo pour retrouver ses nouveautés ici." />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.channelsRow}
          >
            {channels.map((c) => (
              <View key={c.id} style={styles.channelChip}>
                <View style={styles.channelAvatarWrap}>
                  {c.avatar ? (
                    <Image
                      source={{ uri: c.avatar }}
                      style={[styles.channelAvatar, sharedStyles.avatar]}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.channelAvatar, sharedStyles.avatar]} />
                  )}
                  <Pressable
                    onPress={() => toggleSubscription(c)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.unsubscribeBadge, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={12} color="#ffffff" />
                  </Pressable>
                </View>
                <Text style={styles.channelChipName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          {status === 'loading' && feed.length === 0 && <LoadingView label="Chargement des nouveautés..." />}
          {status === 'error' && (
            <ErrorView message="Impossible de charger les nouveautés." onRetry={() => loadFeed(channels)} />
          )}
          {status === 'ready' && feed.length === 0 && <EmptyView message="Pas encore de nouveautés." />}
          {feed.length > 0 && (
            <FlatList
              data={feed}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={status === 'loading'}
                  onRefresh={() => loadFeed(channels)}
                  tintColor={colors.accent}
                />
              }
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
        </>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    channelsRow: {
      gap: 14,
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    channelChip: {
      width: 64,
      alignItems: 'center',
      gap: 6,
    },
    channelAvatarWrap: {
      width: 56,
      height: 56,
    },
    channelAvatar: {
      width: 56,
      height: 56,
    },
    unsubscribeBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: colors.muted,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    pressed: {
      opacity: 0.7,
    },
    channelChipName: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
    },
    list: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 24,
    },
  });
}
