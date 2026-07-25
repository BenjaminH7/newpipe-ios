import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { PlayableSource } from '@/api/youtube';
import type { ProductPlacementSegment } from '@/api/sponsorblock';

const SYNC_THRESHOLD_SECONDS = 0.25;

/**
 * Affiche une source vidéo unique, ou pilote deux lecteurs (vidéo seule +
 * audio seule) gardés synchronisés manuellement : `expo-video` ne propose pas
 * de fusion native de deux flux, donc on aligne l'horloge audio sur celle de
 * la vidéo à chaque `timeUpdate` et on répercute play/pause entre les deux.
 * Le même `timeUpdate` sert aussi à sauter automatiquement les segments de
 * placement de produit (SponsorBlock) quand `skipEnabled` est actif.
 */
export function PlayableVideoView({
  source,
  style,
  onError,
  initialPositionSeconds,
  onProgress,
  segments = [],
  skipEnabled = false,
}: {
  source: PlayableSource;
  style?: StyleProp<ViewStyle>;
  onError: () => void;
  /** Position (en secondes) à laquelle reprendre la lecture, si connue. */
  initialPositionSeconds?: number;
  /** Rappelé à chaque mise à jour du temps de lecture, pour sauvegarder la progression. */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  /** Segments de placement de produit (SponsorBlock) à sauter automatiquement. */
  segments?: ProductPlacementSegment[];
  skipEnabled?: boolean;
}) {
  const isDual = source.kind === 'dual';
  const videoUri = isDual ? source.videoUrl : source.url;
  const audioUri = isDual ? source.audioUrl : null;

  const videoPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.staysActiveInBackground = true;
    // Le flux audio-only (cas "dual") porte le son : c'est lui qui doit piloter
    // les infos de lecture sur l'écran verrouillé, pas la piste vidéo seule.
    p.showNowPlayingNotification = !isDual;
  });
  const audioPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
  });

  // Lus depuis le `timeUpdate` enregistré une seule fois au montage : des refs
  // permettent de suivre `segments`/`skipEnabled` sans recréer les lecteurs.
  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  const skipEnabledRef = useRef(skipEnabled);
  useEffect(() => {
    skipEnabledRef.current = skipEnabled;
  }, [skipEnabled]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await videoPlayer.replaceAsync({ uri: videoUri });
        if (audioUri) await audioPlayer.replaceAsync({ uri: audioUri });
        if (cancelled) return;
        if (initialPositionSeconds && initialPositionSeconds > 0) {
          videoPlayer.currentTime = initialPositionSeconds;
          if (audioUri) audioPlayer.currentTime = initialPositionSeconds;
        }
        videoPlayer.play();
        if (audioUri) audioPlayer.play();
      } catch {
        if (!cancelled) onError();
      }
    })();

    const errorSub = videoPlayer.addListener('statusChange', ({ status }) => {
      if (status === 'error') onError();
    });
    const playingSub = audioUri
      ? videoPlayer.addListener('playingChange', ({ isPlaying }) => {
          if (isPlaying) audioPlayer.play();
          else audioPlayer.pause();
        })
      : null;
    const timeSub = audioUri
      ? videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
          if (Math.abs(audioPlayer.currentTime - currentTime) > SYNC_THRESHOLD_SECONDS) {
            audioPlayer.currentTime = currentTime;
          }
        })
      : null;
    const progressSub = onProgress
      ? videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
          if (videoPlayer.duration > 0) onProgress(currentTime, videoPlayer.duration);
        })
      : null;
    const skipSub = videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
      if (!skipEnabledRef.current) return;
      const segment = segmentsRef.current.find((s) => currentTime >= s.startTime && currentTime < s.endTime);
      if (!segment) return;
      videoPlayer.currentTime = segment.endTime;
      if (audioUri) audioPlayer.currentTime = segment.endTime;
    });

    return () => {
      cancelled = true;
      errorSub.remove();
      playingSub?.remove();
      timeSub?.remove();
      progressSub?.remove();
      skipSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <VideoView player={videoPlayer} style={style} nativeControls allowsPictureInPicture contentFit="contain" />;
}
