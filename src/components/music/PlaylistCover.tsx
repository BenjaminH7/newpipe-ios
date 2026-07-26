// Pochette d'une playlist locale, comme sur Spotify : la pochette du premier
// titre tant qu'il y en a moins de quatre distinctes, sinon une mosaïque 2×2.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme } from '@/theme';

export function PlaylistCover({
  tracks,
  size,
  radius = 4,
}: {
  tracks: MusicTrack[];
  size: number;
  radius?: number;
}) {
  const { colors } = useTheme();

  const covers = useMemo(() => {
    const unique: string[] = [];
    for (const track of tracks) {
      if (track.coverArtUrl && !unique.includes(track.coverArtUrl)) unique.push(track.coverArtUrl);
      if (unique.length === 4) break;
    }
    return unique;
  }, [tracks]);

  const box = { width: size, height: size, borderRadius: radius, backgroundColor: colors.surface };

  if (covers.length === 0) {
    return (
      <View style={[box, styles.center]}>
        <Ionicons name="musical-notes" size={size * 0.34} color={colors.muted} />
      </View>
    );
  }

  if (covers.length < 4) {
    return <Image source={{ uri: covers[0] }} style={box} contentFit="cover" />;
  }

  return (
    <View style={[box, styles.mosaic]}>
      {covers.map((uri) => (
        <Image
          key={uri}
          source={{ uri }}
          style={{ width: size / 2, height: size / 2 }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
});
