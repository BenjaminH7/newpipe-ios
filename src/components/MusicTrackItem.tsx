import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme } from '@/theme';
import { formatDuration } from '@/utils/format';

export function MusicTrackItem({
  track,
  isActive = false,
  isPlaying = false,
  onPress,
  onArtistPress,
  onRemove,
  onRetryDownload,
}: {
  track: MusicTrack;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
  onArtistPress: () => void;
  onRemove: () => void;
  onRetryDownload: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const [removing, setRemoving] = useState(false);
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  const rowAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const startRemoval = () => {
    setRemoving(true);
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.4,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(rowAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => onRemove());
  };

  const confirmRemove = () => {
    Alert.alert(
      'Supprimer ce titre ?',
      `Veux-tu vraiment supprimer "${track.title}" de ta bibliothèque musicale ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: startRemoval },
      ],
    );
  };

  return (
    <Animated.View
      pointerEvents={removing ? 'none' : 'auto'}
      onLayout={rowHeight === null ? (e) => setRowHeight(e.nativeEvent.layout.height) : undefined}
      style={[
        {
          opacity: rowAnim,
          transform: [
            { translateX: rowAnim.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) },
          ],
        },
        removing &&
          rowHeight !== null && {
            height: rowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, rowHeight] }),
            overflow: 'hidden',
          },
      ]}
    >
      <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
        <Image source={{ uri: track.coverArtUrl }} style={[styles.cover, sharedStyles.coverSmall]} contentFit="cover" />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            {isActive && (
              <Ionicons
                name={isPlaying ? 'volume-high' : 'pause'}
                size={14}
                color={colors.accent}
                style={styles.playingIcon}
              />
            )}
            <Text
              style={[sharedStyles.text, styles.title, isActive && { color: colors.accent }]}
              numberOfLines={1}
            >
              {track.title}
            </Text>
          </View>
          <View style={styles.subRow}>
            <Pressable hitSlop={6} onPress={onArtistPress} style={styles.artistPressable}>
              <Text style={[sharedStyles.mutedText, styles.artistLink]} numberOfLines={1}>
                {track.artist}
              </Text>
            </Pressable>
            {track.duration >= 0 && (
              <Text style={sharedStyles.mutedText} numberOfLines={1}>
                {' '}
                · {formatDuration(track.duration)}
              </Text>
            )}
          </View>
        </View>

        {track.downloadStatus === 'downloading' && (
          <ActivityIndicator color={colors.muted} style={styles.status} />
        )}
        {track.downloadStatus === 'failed' && (
          <Pressable hitSlop={8} onPress={onRetryDownload} style={styles.status}>
            <Ionicons name="refresh-circle-outline" size={22} color={colors.accent} />
          </Pressable>
        )}
        {track.downloadStatus === 'downloaded' && (
          <Ionicons name="checkmark-circle" size={18} color={colors.muted} style={styles.status} />
        )}

        <Pressable hitSlop={8} onPress={confirmRemove} style={styles.status} disabled={removing}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons name="heart" size={20} color={colors.accent} />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: 56,
    height: 56,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playingIcon: {
    marginRight: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistPressable: {
    flexShrink: 1,
  },
  artistLink: {
    fontWeight: '600',
  },
  status: {
    marginLeft: 4,
  },
});
