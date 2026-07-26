import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { checkForNewReleases } from '@/api/newReleases';
import { MiniPlayer } from '@/components/MiniPlayer';
import { ReleaseListItem } from '@/components/ReleaseListItem';
import { EmptyView } from '@/components/StatusView';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useFollowedArtists, useToggleArtistFollow } from '@/hooks/useFollowedArtists';
import { useReleasesFeed } from '@/hooks/useReleasesFeed';
import type { ReleaseFeedItem } from '@/storage/releasesFeed';
import { getReleasesFeedSync, loadReleasesFeed, markAllReleasesSeen } from '@/storage/releasesFeed';
import { useTheme, type ColorPalette } from '@/theme';

export default function ReleasesScreen() {
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const artists = useFollowedArtists();
  const toggleFollow = useToggleArtistFollow();
  const feed = useReleasesFeed();
  const { contentBottomPadding } = useBottomOffsets();
  const [refreshing, setRefreshing] = useState(false);

  // Les sorties encore non vues gardent leur point accent le temps de la
  // visite, mais passent "vues" en stockage dès l'affichage : le badge de
  // l'onglet Musique retombe à zéro sans faire disparaître le repère visuel
  // sous les yeux de l'utilisateur.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const absorbUnseen = useCallback(() => {
    const unseen = getReleasesFeedSync().filter((i) => !i.seen);
    if (unseen.length === 0) return;
    setNewIds((prev) => new Set([...prev, ...unseen.map((i) => i.albumId)]));
    markAllReleasesSeen();
  }, []);

  useEffect(() => {
    let active = true;
    loadReleasesFeed().then(() => {
      if (active) absorbUnseen();
    });
    return () => {
      active = false;
    };
  }, [absorbUnseen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await checkForNewReleases({ force: true });
      absorbUnseen();
    } finally {
      setRefreshing(false);
    }
  }, [absorbUnseen]);

  const openArtist = useCallback(
    (browseId: string, name: string) => {
      router.push({ pathname: '/music/artist', params: { browseId, name } });
    },
    [router],
  );

  const openAlbum = useCallback(
    (item: ReleaseFeedItem) => {
      router.push({
        pathname: '/music/album',
        params: { browseId: item.albumId, title: item.title, thumbnail: item.coverUrl },
      });
    },
    [router],
  );

  if (artists.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyView
          icon="notifications-outline"
          title="Aucun artiste suivi"
          message="Appuie sur « Suivre » sur la page d'un artiste : ses nouveaux albums et singles apparaîtront ici."
        />
        <MiniPlayer />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        keyExtractor={(item) => String(item.albumId)}
        contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.artistsScroll}
            contentContainerStyle={styles.artistsRow}
          >
            {artists.map((a) => (
              <View key={a.id} style={styles.artistChip}>
                <View style={styles.artistAvatarWrap}>
                  <Pressable onPress={() => openArtist(a.id, a.name)}>
                    {a.pictureUrl ? (
                      <Image
                        source={{ uri: a.pictureUrl }}
                        style={[styles.artistAvatar, sharedStyles.avatar]}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.artistAvatar, sharedStyles.avatar]} />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => toggleFollow(a, [])}
                    hitSlop={8}
                    style={({ pressed }) => [styles.unfollowBadge, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={12} color="#ffffff" />
                  </Pressable>
                </View>
                <Text style={styles.artistChipName} numberOfLines={1}>
                  {a.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <ReleaseListItem
            item={item}
            isNew={newIds.has(item.albumId)}
            onPress={() => openAlbum(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyView
            icon="sparkles-outline"
            title="Pas encore de nouveautés"
            message="Dès qu'un artiste suivi sort un album, un single ou un EP, il apparaît ici."
          />
        }
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
    list: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    artistsScroll: {
      flexGrow: 0,
      marginHorizontal: -20,
    },
    artistsRow: {
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    artistChip: {
      width: 64,
      alignItems: 'center',
      gap: 6,
    },
    artistAvatarWrap: {
      width: 56,
      height: 56,
    },
    artistAvatar: {
      width: 56,
      height: 56,
    },
    unfollowBadge: {
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
    artistChipName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
    },
  });
}
