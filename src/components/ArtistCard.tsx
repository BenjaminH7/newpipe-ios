import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { DeezerArtist } from '@/api/deezer';
import { useTheme, type ColorPalette } from '@/theme';
import { formatCount } from '@/utils/format';

const AVATAR_SIZE = 96;

export function ArtistCard({ artist, onPress }: { artist: DeezerArtist; onPress: () => void }) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      {artist.pictureUrl ? (
        <Image source={{ uri: artist.pictureUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={40} color={colors.muted} />
        </View>
      )}
      <Text style={[sharedStyles.text, styles.name]} numberOfLines={2}>
        {artist.name}
      </Text>
      {artist.fansCount >= 0 && (
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {formatCount(artist.fansCount)} auditeurs
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      width: AVATAR_SIZE + 16,
      alignItems: 'center',
    },
    pressed: {
      opacity: 0.6,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: colors.surface,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 8,
      textAlign: 'center',
    },
  });
}
