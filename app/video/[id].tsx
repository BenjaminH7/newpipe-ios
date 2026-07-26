import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { getProductPlacementSegments, type ProductPlacementSegment } from '@/api/sponsorblock';
import { getVideoInfo, type PlayableSource, type VideoInfo } from '@/api/youtube';
import { PlayableVideoView } from '@/components/PlayableVideoView';
import { QuotaBlockedView } from '@/components/QuotaBlockedView';
import { useIsInMusicLibrary, useToggleMusicTrack } from '@/hooks/useMusicLibrary';
import { useIsVideoSaved, useToggleSavedVideo } from '@/hooks/useSavedVideos';
import { useIsChannelSubscribed, useToggleChannelSubscription } from '@/hooks/useSubscriptions';
import { useSkipProductPlacements, useVideoQuotaMinutes } from '@/hooks/useSettings';
import { useVideoQuotaExceeded } from '@/hooks/useUsageQuota';
import { recordVideoWatched } from '@/storage/history';
import { addVideoWatchSeconds } from '@/storage/usageQuota';
import { getVideoProgress, loadWatchProgress, saveWatchProgress } from '@/storage/watchProgress';
import { useTheme, type ColorPalette } from '@/theme';
import { formatDuration, formatFullCount, formatUploadDate, formatViews } from '@/utils/format';

// Fréquence minimale entre deux écritures de la progression sur le disque :
// on suit le temps de lecture en continu, mais on ne persiste pas à chaque tick.
const PROGRESS_SAVE_INTERVAL_MS = 5000;

type SearchParams = {
  id: string;
  title?: string;
  thumbnail?: string;
  channelId?: string;
  channelName?: string;
  channelAvatar?: string;
  uploadedDate?: string;
  views?: string;
  duration?: string;
};

type FetchState = 'loading' | 'error' | 'ready';

export default function VideoDetailScreen() {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<SearchParams>();
  const { id } = params;
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [playable, setPlayable] = useState<PlayableSource | null>(null);
  const [playbackUnavailable, setPlaybackUnavailable] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [segments, setSegments] = useState<ProductPlacementSegment[]>([]);
  const [skipEnabled, setSkipEnabled] = useSkipProductPlacements();
  const [videoQuotaMinutes] = useVideoQuotaMinutes();
  const videoQuotaExceeded = useVideoQuotaExceeded();

  const load = useCallback(async () => {
    setFetchState('loading');
    setPlaybackUnavailable(false);
    setPlayable(null);
    setSegments([]);
    try {
      const [{ info: data, playable: source }, , placementSegments] = await Promise.all([
        getVideoInfo(id),
        loadWatchProgress(),
        getProductPlacementSegments(id),
      ]);
      setInfo(data);
      setSegments(placementSegments);
      if (source) {
        setPlayable(source);
        recordVideoWatched({
          id,
          title: data.title,
          thumbnail: params.thumbnail ?? data.thumbnailUrl,
          channelId: data.uploaderId || params.channelId || null,
          channelName: data.uploader,
          channelAvatar: data.uploaderAvatar,
          uploadedDate: formatUploadDate(data.uploadDate),
          duration: data.duration,
          views: data.views,
        });
      } else {
        setPlaybackUnavailable(true);
      }
      setFetchState('ready');
    } catch {
      // On garde les infos déjà connues via les paramètres de navigation (venant de la
      // recherche) : seule la section "détails complets + lecture" est indisponible.
      setPlaybackUnavailable(true);
      setFetchState('error');
    }
  }, [id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Suit la position de lecture courante pour pouvoir sauvegarder la reprise
  // à la sortie de l'écran, sans attendre le prochain tick throttlé.
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const lastSaveRef = useRef(0);
  // Horloge murale du dernier tick, pour cumuler le temps de lecture réel
  // (quota quotidien) sans être faussé par un seek ou un retour d'arrière-plan.
  const quotaTickRef = useRef<number | null>(null);

  const handleProgress = useCallback(
    (position: number, duration: number) => {
      positionRef.current = position;
      durationRef.current = duration;
      const now = Date.now();

      if (quotaTickRef.current !== null) {
        addVideoWatchSeconds((now - quotaTickRef.current) / 1000);
      }
      quotaTickRef.current = now;

      if (now - lastSaveRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
        lastSaveRef.current = now;
        saveWatchProgress(id, position, duration);
      }
    },
    [id],
  );

  useEffect(() => {
    positionRef.current = 0;
    durationRef.current = 0;
    lastSaveRef.current = 0;
    quotaTickRef.current = null;
    return () => {
      if (durationRef.current > 0) {
        saveWatchProgress(id, positionRef.current, durationRef.current);
      }
    };
  }, [id]);

  const title = info?.title ?? params.title ?? '';
  const channelId = info?.uploaderId || params.channelId || '';
  const channelName = info?.uploader ?? params.channelName ?? '';
  const channelAvatar = info?.uploaderAvatar ?? params.channelAvatar ?? null;
  const views = info?.views ?? (params.views ? Number(params.views) : -1);
  const uploadedDateLabel = info ? formatUploadDate(info.uploadDate) : params.uploadedDate ?? null;
  const duration = info?.duration ?? (params.duration ? Number(params.duration) : -1);
  const thumbnail = params.thumbnail;

  const saved = useIsVideoSaved(id);
  const toggleSaved = useToggleSavedVideo();
  const handleToggleSaved = () =>
    toggleSaved({
      id,
      title,
      thumbnail: thumbnail ?? info?.thumbnailUrl ?? '',
      channelId: channelId || null,
      channelName,
      channelAvatar,
      uploadedDate: uploadedDateLabel,
      duration,
      views,
    });

  const inMusic = useIsInMusicLibrary(id);
  const toggleMusic = useToggleMusicTrack();
  const handleToggleMusic = () =>
    toggleMusic({
      id,
      title,
      thumbnail: thumbnail ?? info?.thumbnailUrl ?? '',
      channelId: channelId || null,
      channelName,
      channelAvatar,
      uploadedDate: uploadedDateLabel,
      duration,
      views,
    });

  const subscribed = useIsChannelSubscribed(channelId);
  const toggleSubscription = useToggleChannelSubscription();
  const handleToggleSubscription = () => {
    if (!channelId) return;
    toggleSubscription({ id: channelId, name: channelName, avatar: channelAvatar });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {videoQuotaExceeded ? (
        <View style={styles.playerFallback}>
          <QuotaBlockedView
            message={`Tu as atteint ta limite de lecture vidéo pour aujourd'hui (${videoQuotaMinutes} min). Reviens demain !`}
          />
        </View>
      ) : fetchState === 'ready' && !playbackUnavailable && playable ? (
        <PlayableVideoView
          key={id}
          source={playable}
          style={styles.player}
          onError={() => setPlaybackUnavailable(true)}
          initialPositionSeconds={getVideoProgress(id)?.positionSeconds}
          onProgress={handleProgress}
          segments={segments}
          skipEnabled={skipEnabled}
        />
      ) : (
        <View style={styles.playerFallback}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <View style={styles.playerFallbackOverlay}>
            {fetchState === 'loading' && <ActivityIndicator size="large" color="#ffffff" />}
            {fetchState !== 'loading' && playbackUnavailable && (
              <>
                <Text style={styles.unavailableText}>
                  Lecture indisponible pour le moment{'\n'}
                  (YouTube injoignable ou a bloqué la requête)
                </Text>
                <Pressable style={sharedStyles.button} onPress={load}>
                  <Text style={sharedStyles.buttonText}>Réessayer</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={[sharedStyles.text, styles.title, styles.titleText]}>{title}</Text>
        <Pressable
          onPress={handleToggleMusic}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveButton,
            inMusic && styles.saveButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={inMusic ? 'musical-notes' : 'musical-notes-outline'}
            size={18}
            color={inMusic ? colors.accentText : colors.text}
          />
        </Pressable>
        <Pressable
          onPress={handleToggleSaved}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveButton,
            saved && styles.saveButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={saved ? colors.accentText : colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        {duration >= 0 && <Text style={sharedStyles.mutedText}>{formatDuration(duration)}</Text>}
        {views >= 0 && <Text style={sharedStyles.mutedText}> · {formatViews(views)}</Text>}
        {uploadedDateLabel ? <Text style={sharedStyles.mutedText}> · {uploadedDateLabel}</Text> : null}
        {info && info.likes >= 0 && (
          <Text style={sharedStyles.mutedText}> · {formatFullCount(info.likes)} likes</Text>
        )}
      </View>

      {segments.length > 0 && (
        <Pressable
          onPress={() => setSkipEnabled(!skipEnabled)}
          style={styles.placementRow}
        >
          <Ionicons
            name={skipEnabled ? 'play-skip-forward' : 'play-skip-forward-outline'}
            size={16}
            color={skipEnabled ? colors.accent : colors.muted}
          />
          <Text style={[sharedStyles.mutedText, skipEnabled && styles.placementTextActive]}>
            {segments.length} placement{segments.length > 1 ? 's' : ''} de produit détecté
            {segments.length > 1 ? 's' : ''} · {skipEnabled ? 'passés automatiquement' : 'lecture normale'}
          </Text>
        </Pressable>
      )}

      <View style={styles.channelRow}>
        {channelAvatar ? (
          <Image source={{ uri: channelAvatar }} style={[styles.avatar, sharedStyles.avatar]} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, sharedStyles.avatar]} />
        )}
        <View style={styles.channelText}>
          <Text style={[sharedStyles.text, styles.channelName]}>
            {channelName}
            {info?.uploaderVerified ? ' ✓' : ''}
          </Text>
          {info && info.uploaderSubscriberCount >= 0 && (
            <Text style={sharedStyles.mutedText}>{formatFullCount(info.uploaderSubscriberCount)} abonnés</Text>
          )}
        </View>
        {channelId ? (
          <Pressable
            onPress={handleToggleSubscription}
            style={({ pressed }) => [
              styles.subscribeButton,
              subscribed && styles.subscribeButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.subscribeButtonText, subscribed && styles.subscribeButtonTextActive]}>
              {subscribed ? 'Abonné' : "S'abonner"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {info?.description ? (
        <View style={[sharedStyles.card, styles.descriptionBox]}>
          <Text style={[sharedStyles.text, styles.descriptionText]} numberOfLines={descExpanded ? undefined : 4}>
            {info.description}
          </Text>
          <Pressable onPress={() => setDescExpanded((v) => !v)} style={styles.descriptionToggle}>
            <Text style={styles.descriptionToggleText}>{descExpanded ? 'Voir moins' : 'Voir plus'}</Text>
          </Pressable>
        </View>
      ) : fetchState === 'error' ? (
        <Text style={[sharedStyles.mutedText, styles.descriptionBox]}>
          Impossible de récupérer la description complète pour l'instant.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: 32,
    },
    player: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
    },
    playerFallback: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
    },
    playerFallbackOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 16,
    },
    unavailableText: {
      color: '#ffffff',
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      marginTop: 16,
      gap: 12,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 23,
    },
    titleText: {
      flex: 1,
    },
    saveButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonActive: {
      backgroundColor: colors.accent,
    },
    pressed: {
      opacity: 0.7,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      marginTop: 6,
    },
    placementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignSelf: 'flex-start',
    },
    placementTextActive: {
      color: colors.accent,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      marginTop: 18,
    },
    avatar: {
      width: 40,
      height: 40,
    },
    channelText: {
      flex: 1,
    },
    channelName: {
      fontSize: 15,
      fontWeight: '600',
    },
    subscribeButton: {
      backgroundColor: colors.accent,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    subscribeButtonActive: {
      backgroundColor: colors.surface,
    },
    subscribeButtonText: {
      color: colors.accentText,
      fontSize: 13,
      fontWeight: '600',
    },
    subscribeButtonTextActive: {
      color: colors.text,
    },
    descriptionBox: {
      marginHorizontal: 16,
      marginTop: 18,
      padding: 14,
    },
    descriptionText: {
      fontSize: 13,
      lineHeight: 19,
    },
    descriptionToggle: {
      marginTop: 8,
    },
    descriptionToggleText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
