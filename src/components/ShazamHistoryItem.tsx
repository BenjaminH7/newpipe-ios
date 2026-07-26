import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ShazamHistoryEntry } from '@/storage/shazamHistory';
import { useTheme, type ColorPalette } from '@/theme';
import { formatRelativeTime } from '@/utils/format';

export function ShazamHistoryItem({
  entry,
  onPress,
  onRemove,
}: {
  entry: ShazamHistoryEntry;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
      {entry.artworkUrl ? (
        <Image source={{ uri: entry.artworkUrl }} style={[styles.artwork, sharedStyles.coverSmall]} contentFit="cover" />
      ) : (
        <View style={[styles.artwork, sharedStyles.coverSmall, styles.artworkFallback]}>
          <Ionicons name="musical-note" size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {entry.artist}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {formatRelativeTime(entry.matchedAt)}
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
    artwork: {
      width: 52,
      height: 52,
    },
    artworkFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
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
