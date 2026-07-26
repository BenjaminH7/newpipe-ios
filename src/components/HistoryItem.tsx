import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '@/storage/history';
import { useTheme, type ColorPalette } from '@/theme';
import { formatRelativeTime } from '@/utils/format';

export function HistoryItem({
  entry,
  onPress,
  onRemove,
}: {
  entry: HistoryEntry;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const thumbnail = entry.kind === 'video' ? entry.video.thumbnail : entry.track.coverArtUrl;
  const title = entry.kind === 'video' ? entry.video.title : entry.track.title;
  const subtitle = entry.kind === 'video' ? entry.video.channelName : entry.track.artist;

  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.thumbnailWrap}>
        <Image source={{ uri: thumbnail }} style={[styles.thumbnail, sharedStyles.thumbnail]} contentFit="cover" />
        <View style={styles.kindBadge}>
          <Ionicons
            name={entry.kind === 'video' ? 'play' : 'musical-notes'}
            size={10}
            color={colors.accentText}
          />
        </View>
      </View>
      <View style={styles.info}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {formatRelativeTime(entry.watchedAt)}
        </Text>
      </View>
      <Pressable hitSlop={8} onPress={onRemove} style={styles.removeButton}>
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    pressed: {
      opacity: 0.7,
    },
    thumbnailWrap: {
      width: 76,
      height: 52,
      borderRadius: 8,
      overflow: 'hidden',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    kindBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
    },
    removeButton: {
      padding: 4,
    },
  });
}
