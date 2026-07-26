import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
// Fond d'écran ambiant façon Spotify/Apple Music : la pochette elle-même,
// très floutée et assombrie par un dégradé, sert de décor en plein cadre
// derrière l'interface. Pas d'extraction de couleur dominante (nécessiterait
// une lib native incompatible avec Expo Go SDK 54) : le flou d'expo-image
// (déjà inclus, pas de dépendance native supplémentaire) donne un résultat
// tout aussi immersif et toujours fidèle à la pochette réelle.
const BACKDROP_BLUR_RADIUS = 60;

export default function MusicPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // En pageSheet iOS, la feuille s'arrête déjà sous la barre de statut : un
  // petit padding fixe suffit. Sur Android le modal est plein écran, il faut
  // donc dégager la barre de statut avec l'inset système.
  const topPadding = Platform.OS === 'android' ? insets.top + 8 : 12;
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    shuffle,
    repeat,
    sleepTimerRemaining,
    radioEnabled,
    radioLoading,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    cycleRepeat,
    setSleepTimer,
    toggleRadio,
  } = usePlayer();
  const [trackWidth, setTrackWidth] = useState(0);
  // Taille de pochette déterministe, calculée depuis les dimensions de la
  // fenêtre : pleine largeur, plafonnée à 40 % de la hauteur d'écran pour que
  // le bloc de contrôles tienne toujours. Surtout pas de mesure onLayout d'une
  // zone flex : dans une feuille modale, cette hauteur peut s'effondrer à 0
  // et la pochette ne s'affichait jamais.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const coverSize = Math.min(windowWidth - 48, Math.round(windowHeight * 0.4));
  const isInLibrary = useIsInMusicLibrary(currentTrack?.id ?? '');
  const toggleTrackInLibrary = useToggleTrackInLibrary();
  const [musicQuotaMinutes] = useMusicQuotaMinutes();
  const [translateLyrics] = useTranslateLyrics();
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
    setLyrics(null);
    setLyricsStatus('loading');
    setSyncedTranslations(null);
    setPlainTranslation(null);
    fetchLyrics(currentTrack)
      .then((result) => {
        if (cancelled) return;
        setLyrics(result);
        setLyricsStatus(result ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setLyricsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  // Traduction en français des paroles, chargée une fois qu'elles sont
  // disponibles (synchronisées ligne par ligne, ou en bloc pour le texte brut).
  // Contrôlée uniquement par le réglage "Traduire les paroles" des réglages.
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

  // Suivi automatique de la ligne active. On ne force pas le défilement
  // pendant que l'utilisateur fait défiler lui-même (sinon la liste "saute"
  // sous son doigt) : on reprend la main quelques secondes après son geste.
  const userScrollingRef = useRef(false);
  const userScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserScrollBegin = useCallback(() => {
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    userScrollingRef.current = true;
  }, []);

  const handleUserScrollEnd = useCallback(() => {
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    userScrollTimeout.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 4000);
  }, []);

  useEffect(
    () => () => {
      if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (!showLyrics || activeLyricsLine < 0 || userScrollingRef.current) return;
    // Petit délai pour laisser la FlatList se monter quand on vient d'ouvrir
    // le panneau des paroles (sinon scrollToIndex tombe dans le vide).
    const timer = setTimeout(() => {
      try {
        lyricsListRef.current?.scrollToIndex({ index: activeLyricsLine, viewPosition: 0.4, animated: true });
      } catch {
        // Liste pas encore mesurée : onScrollToIndexFailed prendra le relais.
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeLyricsLine, showLyrics]);

  // Les lignes ont des hauteurs variables : quand la cible n'est pas encore
  // rendue, scrollToIndex échoue. On s'approche à l'estime puis on retente.
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      lyricsListRef.current?.scrollToOffset({ offset: info.index * info.averageItemLength, animated: false });
      setTimeout(() => {
        if (userScrollingRef.current) return;
        try {
          lyricsListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.4, animated: true });
        } catch {
          // Tant pis pour ce tick, le prochain changement de ligne retentera.
        }
      }, 250);
    },
    [],
  );

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
  // Le curseur (le petit rond) reste invisible tant qu'on n'interagit pas
  // avec la barre : il apparaît en fondu/zoom sous le doigt pendant le
  // glissement, puis disparaît au relâchement.
  const thumbAnim = useRef(new Animated.Value(0)).current;
  // Progression fluide : le player ne rapporte sa position que toutes les
  // 0,5 s, ce qui faisait avancer la barre par à-coups. On anime donc une
  // valeur [0..1] sur le driver natif : à chaque tick on la recale sur la
  // position réelle puis on la fait glisser linéairement vers la fin de
  // piste — mouvement continu, dérive auto-corrigée au tick suivant.
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  useEffect(() => {
    if (isSeeking) return; // le doigt pilote la barre (setValue direct)
    if (duration <= 0) {
      progressAnim.setValue(0);
      return;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(Math.min(1, Math.max(0, position / duration)));
    if (!isPlaying) return;
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(0, (duration - position) * 1000),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [position, duration, isPlaying, isSeeking, progressAnim]);

  const updateRatioFromPageX = useCallback(
    (pageX: number) => {
      if (trackWidthRef.current === 0) return;
      const ratio = Math.min(1, Math.max(0, (pageX - trackPageXRef.current) / trackWidthRef.current));
      seekRatioRef.current = ratio;
      setSeekRatio(ratio);
      progressAnim.setValue(ratio);
    },
    [progressAnim],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        // Origine X de la barre recalculée à chaque prise de doigt : les
        // enfants étant en pointerEvents="none", locationX est toujours
        // relatif à la zone tactile — fiable même si l'écran a bougé depuis
        // la mesure du layout (modale qui glisse, rotation…).
        trackPageXRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        progressAnim.stopAnimation();
        setIsSeeking(true);
        updateRatioFromPageX(e.nativeEvent.pageX);
        Animated.timing(thumbAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateRatioFromPageX(e.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        seekToRef.current(seekRatioRef.current * durationRef.current);
        setIsSeeking(false);
        Animated.timing(thumbAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
        Animated.timing(thumbAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      },
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
      <View style={[styles.container, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={28} color="#ffffff" />
        </Pressable>
        <QuotaBlockedView
          message={`Tu as atteint ta limite d'écoute musicale pour aujourd'hui (${musicQuotaMinutes} min). Reviens demain !`}
        />
      </View>
    );
  }

  if (!currentTrack) {
    return (
      <View style={[styles.empty, { paddingTop: topPadding }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={26} color="#ffffff" />
        </Pressable>
        <Text style={styles.emptyText}>Aucune piste en cours de lecture.</Text>
      </View>
    );
  }

  const displayPosition = isSeeking ? seekRatio * duration : position;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={{ uri: currentTrack.coverArtUrl }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        blurRadius={BACKDROP_BLUR_RADIUS}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[styles.content, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Barre supérieure épurée façon Spotify : fermeture à gauche, contexte
            au centre — les actions secondaires vivent en bas de l'écran. */}
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.topRowSide}>
            <Ionicons name="chevron-down" size={26} color="#ffffff" />
          </Pressable>
          <Text style={styles.topRowLabel} numberOfLines={1}>
            {radioEnabled ? 'Radio' : 'En lecture'}
          </Text>
          <View style={styles.topRowSide} />
        </View>

        {showLyrics ? (
          <View style={styles.lyricsCard}>
            {lyricsStatus === 'loading' && (
              <ActivityIndicator color="rgba(255,255,255,0.7)" style={styles.lyricsLoading} />
            )}
            {lyricsStatus === 'error' && (
              <Text style={styles.lyricsEmpty}>Paroles indisponibles pour cette piste.</Text>
            )}
            {lyricsStatus === 'ready' && lyrics?.synced && lyrics.synced.length > 0 && (
              <FlatList
                ref={lyricsListRef}
                data={lyrics.synced}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={styles.lyricsListContent}
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={handleScrollToIndexFailed}
                onScrollBeginDrag={handleUserScrollBegin}
                onScrollEndDrag={handleUserScrollEnd}
                onMomentumScrollEnd={handleUserScrollEnd}
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
          <View style={styles.coverArea}>
            <Image
              source={{ uri: currentTrack.coverArtUrl }}
              style={[styles.cover, { width: coverSize, height: coverSize }]}
              contentFit="cover"
            />
          </View>
        )}

        <View style={styles.meta}>
          <View style={styles.metaText}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Pressable
              hitSlop={6}
              onPress={() => router.push({ pathname: '/music/artist', params: { artist: currentTrack.artist } })}
            >
              <Text style={styles.artistLink} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </Pressable>
          </View>
          <Pressable hitSlop={12} onPress={() => toggleTrackInLibrary(currentTrack)} style={styles.favoriteButton}>
            <Ionicons name={isInLibrary ? 'heart' : 'heart-outline'} size={26} color={isInLibrary ? colors.accent : '#ffffff'} />
          </Pressable>
        </View>

        <View
          ref={trackRef}
          style={styles.progressTouchArea}
          onLayout={handleTrackLayout}
          {...panResponder.panHandlers}
        >
          {/* Remplissage et curseur déplacés en translateX (driver natif) plutôt
              qu'en width/left : la barre glisse à 60 fps sans repasser par JS. */}
          <View style={styles.progressTrack} pointerEvents="none">
            {trackWidth > 0 && (
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    transform: [
                      {
                        translateX: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-trackWidth, 0],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </View>
          {trackWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.progressThumb,
                {
                  opacity: thumbAnim,
                  transform: [
                    {
                      translateX: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, trackWidth],
                      }),
                    },
                    { scale: thumbAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                  ],
                },
              ]}
            />
          )}
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(displayPosition)}</Text>
          <Text style={styles.timeText}>{formatDuration(duration)}</Text>
        </View>

        <View style={styles.controlsRow}>
          <Pressable hitSlop={12} onPress={toggleShuffle}>
            <Ionicons name="shuffle" size={24} color={shuffle ? colors.accent : 'rgba(255,255,255,0.7)'} />
          </Pressable>
          <Pressable hitSlop={12} onPress={playPrevious}>
            <Ionicons name="play-skip-back" size={32} color="#ffffff" />
          </Pressable>
          <Pressable
            hitSlop={12}
            onPress={togglePlay}
            style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
          >
            {isBuffering ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color="#121212"
                style={!isPlaying && styles.playIconNudge}
              />
            )}
          </Pressable>
          <Pressable hitSlop={12} onPress={playNext}>
            <Ionicons name="play-skip-forward" size={32} color="#ffffff" />
          </Pressable>
          <Pressable hitSlop={12} onPress={cycleRepeat} style={styles.repeatButton}>
            <Ionicons name="repeat" size={24} color={repeat === 'off' ? 'rgba(255,255,255,0.7)' : colors.accent} />
            {repeat === 'one' && <Text style={styles.repeatOneBadge}>1</Text>}
          </Pressable>
        </View>

        {/* Actions secondaires en pied d'écran, comme la rangée
            appareils/partage/file d'attente de Spotify. */}
        <View style={styles.secondaryRow}>
          <View style={styles.secondaryGroup}>
            <Pressable onPress={toggleRadio} hitSlop={10} disabled={radioLoading}>
              {radioLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons
                  name={radioEnabled ? 'radio' : 'radio-outline'}
                  size={22}
                  color={radioEnabled ? colors.accent : 'rgba(255,255,255,0.7)'}
                />
              )}
            </Pressable>
            <Pressable onPress={openSleepTimerPicker} hitSlop={10} style={styles.sleepTimerButton}>
              <Ionicons
                name="timer-outline"
                size={22}
                color={sleepTimerRemaining !== null ? colors.accent : 'rgba(255,255,255,0.7)'}
              />
              {sleepTimerRemaining !== null && (
                <Text style={styles.sleepTimerText}>{formatDuration(sleepTimerRemaining)}</Text>
              )}
            </Pressable>
          </View>
          <Pressable onPress={() => setShowLyrics((v) => !v)} hitSlop={10}>
            <Ionicons
              name={showLyrics ? 'mic' : 'mic-outline'}
              size={22}
              color={showLyrics ? colors.accent : 'rgba(255,255,255,0.7)'}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    // Le player est toujours sombre (pochette floutée + voile noir), même en
    // thème clair — un fond clair apparaissait en gris sous le voile pendant
    // le chargement de la pochette.
    container: {
      flex: 1,
      backgroundColor: '#121212',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
    },
    empty: {
      flex: 1,
      backgroundColor: '#121212',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    emptyText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 14,
    },
    closeButton: {
      alignSelf: 'center',
      marginBottom: 12,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    // Zones latérales de même largeur pour garder le label parfaitement
    // centré (la droite est un simple espaceur).
    topRowSide: {
      width: 40,
      alignItems: 'flex-start',
    },
    topRowLabel: {
      flex: 1,
      textAlign: 'center',
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    coverArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 8,
    },
    cover: {
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 10,
    },
    // Paroles présentées en carte arrondie sur le fond flouté, comme la carte
    // lyrics de Spotify.
    lyricsCard: {
      flex: 1,
      marginTop: 8,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 18,
      overflow: 'hidden',
    },
    lyricsLoading: {
      marginTop: 24,
    },
    lyricsEmpty: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 15,
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
      color: 'rgba(255,255,255,0.6)',
      fontSize: 23,
      fontWeight: '700',
      lineHeight: 30,
    },
    lyricsLineActive: {
      color: '#ffffff',
    },
    lyricsTranslation: {
      color: 'rgba(255,255,255,0.55)',
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
      color: '#ffffff',
      fontSize: 19,
      lineHeight: 28,
    },
    translationDivider: {
      color: 'rgba(255,255,255,0.6)',
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
      marginTop: 20,
      gap: 12,
    },
    metaText: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: '#ffffff',
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 28,
      letterSpacing: -0.5,
    },
    artistLink: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 16,
      fontWeight: '500',
    },
    favoriteButton: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTouchArea: {
      justifyContent: 'center',
      marginTop: 16,
      paddingVertical: 10,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    },
    progressFill: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 2,
      backgroundColor: '#ffffff',
    },
    progressThumb: {
      position: 'absolute',
      top: '50%',
      left: -6,
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: -6,
      backgroundColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    timeText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 12,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    // Bouton play blanc à icône noire, la signature du lecteur Spotify —
    // le fond est toujours sombre ici (pochette floutée + dégradé noir).
    playButton: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    playButtonPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
    playIconNudge: {
      marginLeft: 3,
    },
    repeatButton: {
      width: 24,
      height: 24,
    },
    repeatOneBadge: {
      position: 'absolute',
      bottom: -6,
      right: -8,
      fontSize: 9,
      fontWeight: '700',
      color: colors.accent,
    },
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    secondaryGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 24,
    },
    sleepTimerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sleepTimerText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  });
}
