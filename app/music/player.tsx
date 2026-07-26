import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchLyrics, type LyricsLine, type LyricsResult } from '@/api/lyrics';
import { QuotaBlockedView } from '@/components/QuotaBlockedView';
import { useMusicQuotaMinutes } from '@/hooks/useSettings';
import { useMusicQuotaExceeded } from '@/hooks/useUsageQuota';
import { usePlayer } from '@/player/PlayerContext';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration } from '@/utils/format';

const SLEEP_TIMER_PRESETS_MINUTES = [5, 15, 30, 45, 60];

export default function MusicPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    shuffle,
    repeat,
    sleepTimerRemaining,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    cycleRepeat,
    setSleepTimer,
  } = usePlayer();
  const [trackWidth, setTrackWidth] = useState(0);
  const [musicQuotaMinutes] = useMusicQuotaMinutes();
  const musicQuotaExceeded = useMusicQuotaExceeded();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const lyricsListRef = useRef<FlatList<LyricsLine>>(null);

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLyricsStatus('loading');
    fetchLyrics(currentTrack).then((result) => {
      if (cancelled) return;
      setLyrics(result);
      setLyricsStatus(result ? 'ready' : 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  const activeLyricsLine = useMemo(() => {
    if (!lyrics?.synced) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].time <= position) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, position]);

  useEffect(() => {
    if (activeLyricsLine < 0) return;
    try {
      lyricsListRef.current?.scrollToIndex({ index: activeLyricsLine, viewPosition: 0.4, animated: true });
    } catch {
      // La liste peut ne pas être encore mesurée : on retentera au prochain tick.
    }
  }, [activeLyricsLine]);

  const openSleepTimerPicker = () => {
    const buttons = [
      ...SLEEP_TIMER_PRESETS_MINUTES.map((minutes) => ({
        text: `${minutes} min`,
        onPress: () => setSleepTimer(minutes),
      })),
      ...(sleepTimerRemaining !== null
        ? [{ text: 'Désactiver', style: 'destructive' as const, onPress: () => setSleepTimer(null) }]
        : []),
      { text: 'Annuler', style: 'cancel' as const },
    ];
    Alert.alert('Mise en veille', 'Mettre la lecture en pause après :', buttons);
  };

  if (musicQuotaExceeded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <QuotaBlockedView
          message={`Tu as atteint ta limite d'écoute musicale pour aujourd'hui (${musicQuotaMinutes} min). Reviens demain !`}
        />
      </View>
    );
  }

  if (!currentTrack) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <Text style={sharedStyles.mutedText}>Aucune piste en cours de lecture.</Text>
      </View>
    );
  }

  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const handleSeek = (e: GestureResponderEvent) => {
    if (trackWidth === 0 || duration <= 0) return;
    const x = e.nativeEvent.locationX;
    const nextRatio = Math.min(1, Math.max(0, x / trackWidth));
    seekTo(nextRatio * duration);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.topRowRight}>
          <Pressable onPress={() => setShowLyrics((v) => !v)} hitSlop={8}>
            <Ionicons name={showLyrics ? 'mic' : 'mic-outline'} size={22} color={showLyrics ? colors.accent : colors.text} />
          </Pressable>
          <Pressable onPress={openSleepTimerPicker} hitSlop={8}>
            <Ionicons name="timer-outline" size={22} color={sleepTimerRemaining !== null ? colors.accent : colors.text} />
          </Pressable>
        </View>
      </View>
      {sleepTimerRemaining !== null && (
        <Text style={styles.sleepTimerLabel}>Pause automatique dans {formatDuration(sleepTimerRemaining)}</Text>
      )}

      {showLyrics ? (
        <View style={styles.lyricsPane}>
          {lyricsStatus === 'loading' && <ActivityIndicator color={colors.muted} style={styles.lyricsLoading} />}
          {lyricsStatus === 'error' && (
            <Text style={[sharedStyles.mutedText, styles.lyricsEmpty]}>Paroles indisponibles pour cette piste.</Text>
          )}
          {lyricsStatus === 'ready' && lyrics?.synced && lyrics.synced.length > 0 && (
            <FlatList
              ref={lyricsListRef}
              data={lyrics.synced}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.lyricsListContent}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item, index }) => (
                <Text style={[styles.lyricsLine, index === activeLyricsLine && styles.lyricsLineActive]}>
                  {item.text || '♪'}
                </Text>
              )}
            />
          )}
          {lyricsStatus === 'ready' && (!lyrics?.synced || lyrics.synced.length === 0) && lyrics?.plain && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lyricsListContent}>
              <Text style={styles.lyricsPlainText}>{lyrics.plain}</Text>
            </ScrollView>
          )}
        </View>
      ) : (
        <Image
          source={{ uri: currentTrack.coverArtUrl }}
          style={[styles.cover, sharedStyles.thumbnail]}
          contentFit="cover"
        />
      )}

      <View style={styles.meta}>
        <Text style={[sharedStyles.text, styles.title]} numberOfLines={2}>
          {currentTrack.title}
        </Text>
        <Text style={sharedStyles.mutedText} numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>

      <Pressable
        style={styles.progressTrack}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        onPress={handleSeek}
      >
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={sharedStyles.mutedText}>{formatDuration(position)}</Text>
        <Text style={sharedStyles.mutedText}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.controlsRow}>
        <Pressable hitSlop={12} onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={22} color={shuffle ? colors.accent : colors.muted} />
        </Pressable>
        <Pressable hitSlop={12} onPress={playPrevious}>
          <Ionicons name="play-skip-back" size={30} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={12} onPress={togglePlay} style={styles.playButton}>
          {isBuffering ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color={colors.accentText} />
          )}
        </Pressable>
        <Pressable hitSlop={12} onPress={playNext}>
          <Ionicons name="play-skip-forward" size={30} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={12} onPress={cycleRepeat} style={styles.repeatButton}>
          <Ionicons name="repeat" size={22} color={repeat === 'off' ? colors.muted : colors.accent} />
          {repeat === 'one' && <Text style={styles.repeatOneBadge}>1</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    empty: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    closeButton: {
      alignSelf: 'center',
      marginBottom: 12,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    topRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    sleepTimerLabel: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    cover: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      alignSelf: 'center',
    },
    lyricsPane: {
      flex: 1,
    },
    lyricsLoading: {
      marginTop: 24,
    },
    lyricsEmpty: {
      marginTop: 24,
      textAlign: 'center',
    },
    lyricsListContent: {
      paddingVertical: 12,
    },
    lyricsLine: {
      color: colors.muted,
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 26,
      marginBottom: 14,
    },
    lyricsLineActive: {
      color: colors.text,
    },
    lyricsPlainText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 24,
    },
    meta: {
      marginTop: 28,
      gap: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surface,
      marginTop: 28,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 36,
    },
    playButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    repeatButton: {
      width: 22,
      height: 22,
    },
    repeatOneBadge: {
      position: 'absolute',
      bottom: -6,
      right: -8,
      fontSize: 9,
      fontWeight: '700',
      color: colors.accent,
    },
  });
}
