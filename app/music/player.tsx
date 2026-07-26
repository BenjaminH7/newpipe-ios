import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PanResponder,
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
import { translateLines, translateText } from '@/api/translate';
import { QuotaBlockedView } from '@/components/QuotaBlockedView';
import { useIsInMusicLibrary, useToggleTrackInLibrary } from '@/hooks/useMusicLibrary';
import { useMusicQuotaMinutes, useTranslateLyrics } from '@/hooks/useSettings';
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
  const isInLibrary = useIsInMusicLibrary(currentTrack?.id ?? '');
  const toggleTrackInLibrary = useToggleTrackInLibrary();
  const [musicQuotaMinutes] = useMusicQuotaMinutes();
  const [translateLyrics, setTranslateLyrics] = useTranslateLyrics();
  const musicQuotaExceeded = useMusicQuotaExceeded();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [syncedTranslations, setSyncedTranslations] = useState<(string | null)[] | null>(null);
  const [plainTranslation, setPlainTranslation] = useState<string | null>(null);
  const lyricsListRef = useRef<FlatList<LyricsLine>>(null);

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLyricsStatus('loading');
    setSyncedTranslations(null);
    setPlainTranslation(null);
    fetchLyrics(currentTrack).then((result) => {
      if (cancelled) return;
      setLyrics(result);
      setLyricsStatus(result ? 'ready' : 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  // Traduction en français des paroles, chargée une fois qu'elles sont
  // disponibles (synchronisées ligne par ligne, ou en bloc pour le texte brut).
  // Contrôlée par le réglage "Traduire les paroles" (activable aussi via
  // l'icône dédiée du lecteur).
  useEffect(() => {
    if (!lyrics || !translateLyrics) return;
    let cancelled = false;
    if (lyrics.synced && lyrics.synced.length > 0) {
      translateLines(lyrics.synced.map((line) => line.text)).then((result) => {
        if (!cancelled) setSyncedTranslations(result);
      });
    } else if (lyrics.plain) {
      translateText(lyrics.plain).then((result) => {
        if (!cancelled) setPlainTranslation(result);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [lyrics, translateLyrics]);

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

  // Barre de progression glissable : on suit le doigt en continu (isSeeking +
  // seekRatio) et on ne notifie le player qu'au relâchement, comme un slider
  // natif classique. Les refs évitent de recréer le PanResponder à chaque
  // rendu tout en lisant toujours les dernières valeurs de duration/seekTo.
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekRatio, setSeekRatio] = useState(0);
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const seekRatioRef = useRef(0);
  const durationRef = useRef(duration);
  const seekToRef = useRef(seekTo);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  const updateRatioFromPageX = useCallback((pageX: number) => {
    if (trackWidthRef.current === 0) return;
    const ratio = Math.min(1, Math.max(0, (pageX - trackPageXRef.current) / trackWidthRef.current));
    seekRatioRef.current = ratio;
    setSeekRatio(ratio);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        setIsSeeking(true);
        updateRatioFromPageX(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateRatioFromPageX(e.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        seekToRef.current(seekRatioRef.current * durationRef.current);
        setIsSeeking(false);
      },
      onPanResponderTerminate: () => setIsSeeking(false),
    }),
  ).current;

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
    trackRef.current?.measure((_x, _y, _width, _height, pageX) => {
      trackPageXRef.current = pageX;
    });
  }, []);

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
  const displayRatio = isSeeking ? seekRatio : ratio;
  const displayPosition = isSeeking ? seekRatio * duration : position;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.topRow}>
        <Text style={styles.topRowLabel} numberOfLines={1}>
          Lecture en cours
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.topRowRight}>
          <Pressable onPress={() => setShowLyrics((v) => !v)} hitSlop={8}>
            <Ionicons name={showLyrics ? 'mic' : 'mic-outline'} size={22} color={showLyrics ? colors.accent : colors.text} />
          </Pressable>
          {showLyrics && (
            <Pressable onPress={() => setTranslateLyrics(!translateLyrics)} hitSlop={8}>
              <Ionicons
                name={translateLyrics ? 'language' : 'language-outline'}
                size={22}
                color={translateLyrics ? colors.accent : colors.text}
              />
            </Pressable>
          )}
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
                <View style={styles.lyricsLineWrap}>
                  <Text style={[styles.lyricsLine, index === activeLyricsLine && styles.lyricsLineActive]}>
                    {item.text || '♪'}
                  </Text>
                  {translateLyrics && syncedTranslations?.[index] && (
                    <Text
                      style={[
                        styles.lyricsTranslation,
                        index === activeLyricsLine && styles.lyricsTranslationActive,
                      ]}
                    >
                      {syncedTranslations[index]}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
          {lyricsStatus === 'ready' && (!lyrics?.synced || lyrics.synced.length === 0) && lyrics?.plain && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lyricsListContent}>
              <Text style={styles.lyricsPlainText}>{lyrics.plain}</Text>
              {translateLyrics && plainTranslation && (
                <>
                  <Text style={styles.translationDivider}>Traduction</Text>
                  <Text style={styles.lyricsPlainText}>{plainTranslation}</Text>
                </>
              )}
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
        <View style={styles.metaText}>
          <Text style={[sharedStyles.text, styles.title]} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Pressable
            hitSlop={6}
            onPress={() => router.push({ pathname: '/music/artist', params: { artist: currentTrack.artist } })}
          >
            <Text style={[sharedStyles.mutedText, styles.artistLink]} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </Pressable>
        </View>
        <Pressable hitSlop={12} onPress={() => toggleTrackInLibrary(currentTrack)} style={styles.favoriteButton}>
          <Ionicons name={isInLibrary ? 'heart' : 'heart-outline'} size={26} color={isInLibrary ? colors.accent : colors.text} />
        </Pressable>
      </View>

      <View
        ref={trackRef}
        style={styles.progressTouchArea}
        onLayout={handleTrackLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${displayRatio * 100}%` }]} />
        </View>
        <View style={[styles.progressThumb, { left: `${displayRatio * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={sharedStyles.mutedText}>{formatDuration(displayPosition)}</Text>
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
    topRowLabel: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
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
    lyricsLineWrap: {
      marginBottom: 20,
    },
    lyricsLine: {
      color: colors.muted,
      fontSize: 23,
      fontWeight: '700',
      lineHeight: 30,
    },
    lyricsLineActive: {
      color: colors.text,
    },
    lyricsTranslation: {
      color: colors.muted,
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 21,
      marginTop: 3,
      opacity: 0.8,
    },
    lyricsTranslationActive: {
      color: colors.accent,
      opacity: 1,
    },
    lyricsPlainText: {
      color: colors.text,
      fontSize: 19,
      lineHeight: 28,
    },
    translationDivider: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 8,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 28,
      gap: 12,
    },
    metaText: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 28,
    },
    artistLink: {
      fontWeight: '600',
    },
    favoriteButton: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTouchArea: {
      justifyContent: 'center',
      marginTop: 28,
      paddingVertical: 10,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
    },
    progressThumb: {
      position: 'absolute',
      top: '50%',
      width: 14,
      height: 14,
      borderRadius: 7,
      marginTop: -7,
      marginLeft: -7,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
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
