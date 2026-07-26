// Lecteur audio global de l'onglet Musique : un seul player `expo-video`
// monté une fois à la racine de l'app (comme le WebView caché de
// JsEngineView), exposé via un contexte pour que la mini-player, l'écran
// "En cours de lecture" et l'onglet Musique restent synchronisés sans lib
// d'état externe. Mêmes idées que PlayableVideoView (screen lock, arrière-
// plan) mais pour une file de pistes plutôt qu'une vidéo unique.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { radioTrackToMusicTrack } from '@/api/musicMatch';
import { getRadioQueue, getVideoInfo } from '@/api/youtube';
import { useMusicQuotaExceeded } from '@/hooks/useUsageQuota';
import { recordMusicPlayed } from '@/storage/history';
import { getLocalAudioUri } from '@/storage/musicDownloads';
import type { MusicTrack } from '@/storage/musicLibrary';
import { addMusicListenSeconds } from '@/storage/usageQuota';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextValue {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Secondes restantes avant la mise en pause automatique, ou `null` si désactivée. */
  sleepTimerRemaining: number | null;
  /** Radio activée : la file s'étend automatiquement (Mix YouTube) une fois la fin atteinte. */
  radioEnabled: boolean;
  /** Chargement des morceaux suivants de la radio en cours (seed initiale ou extension). */
  radioLoading: boolean;
  playTrack: (track: MusicTrack, queue: MusicTrack[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /** `minutes` = délai avant pause automatique, `null` pour désactiver la minuterie. */
  setSleepTimer: (minutes: number | null) => void;
  /** Active/désactive la radio à partir de la piste en cours (voir `radioEnabled`). */
  toggleRadio: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Piste locale si déjà téléchargée (lecture hors-ligne) ; sinon on retente un
// flux audio frais auprès de YouTube (best-effort, nécessite le réseau).
async function resolvePlaybackUri(track: MusicTrack): Promise<string | null> {
  const localUri = getLocalAudioUri(track.id);
  if (localUri) return localUri;
  try {
    const { playable } = await getVideoInfo(track.id);
    if (!playable) return null;
    return playable.kind === 'dual' ? playable.audioUrl : playable.url;
  } catch {
    return null;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [radioEnabled, setRadioEnabled] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
    p.timeUpdateEventInterval = 0.5;
  });

  // Refs pour lire l'état courant depuis des callbacks stables (listeners du
  // player, montés une seule fois) sans les reconstruire à chaque changement.
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);
  const repeatRef = useRef(repeat);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  const shuffleRef = useRef(shuffle);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  const radioEnabledRef = useRef(radioEnabled);
  useEffect(() => {
    radioEnabledRef.current = radioEnabled;
  }, [radioEnabled]);

  // Quota d'écoute quotidien : une fois dépassé, on bloque le démarrage de
  // nouvelles pistes et on coupe la lecture en cours (voir effet plus bas).
  const musicQuotaExceeded = useMusicQuotaExceeded();
  const musicQuotaExceededRef = useRef(musicQuotaExceeded);
  useEffect(() => {
    musicQuotaExceededRef.current = musicQuotaExceeded;
  }, [musicQuotaExceeded]);
  // Horloge murale du dernier tick, pour cumuler le temps d'écoute réel sans
  // être faussé par un changement de piste ou un retour d'arrière-plan.
  const quotaTickRef = useRef<number | null>(null);

  // Cache les résolutions de flux en cours/terminées par identifiant de
  // piste. Sert à la fois à dédoublonner les appels concurrents et à
  // préparer le flux de la piste suivante pendant que la piste courante
  // joue encore (resolvePlaybackUri passe par plusieurs requêtes réseau et
  // la WebView BotGuard, plusieurs secondes) : sans ça, chaque transition
  // attend tout ce pipeline à froid, d'où le "lag" au changement de piste.
  const playbackUriCache = useRef(new Map<string, Promise<string | null>>()).current;

  const getPlaybackUri = useCallback(
    (track: MusicTrack): Promise<string | null> => {
      const cached = playbackUriCache.get(track.id);
      if (cached) return cached;
      const promise = resolvePlaybackUri(track).then((uri) => {
        // Échec : on ne garde pas l'échec en cache pour permettre une
        // nouvelle tentative (réseau temporairement indisponible, etc.).
        if (uri === null) playbackUriCache.delete(track.id);
        return uri;
      });
      playbackUriCache.set(track.id, promise);
      if (playbackUriCache.size > 8) {
        const oldestKey = playbackUriCache.keys().next().value;
        if (oldestKey !== undefined) playbackUriCache.delete(oldestKey);
      }
      return promise;
    },
    [playbackUriCache],
  );

  // Précharge le flux de la piste qui suivra `fromTrack` si l'avance est
  // prévisible (pas de lecture aléatoire, qui tire au sort au moment venu).
  const prefetchNextTrack = useCallback(
    (fromTrack: MusicTrack) => {
      if (shuffleRef.current || repeatRef.current === 'one') return;
      const q = queueRef.current;
      const idx = q.findIndex((t) => t.id === fromTrack.id);
      if (idx === -1) return;
      let nextIdx = idx + 1;
      if (nextIdx >= q.length) {
        if (repeatRef.current !== 'all') return;
        nextIdx = 0;
      }
      const next = q[nextIdx];
      if (next && next.id !== fromTrack.id) getPlaybackUri(next);
    },
    [getPlaybackUri],
  );

  const loadAndPlay = useCallback(
    async (track: MusicTrack) => {
      if (musicQuotaExceededRef.current) {
        Alert.alert(
          "Limite atteinte",
          "Tu as atteint ta limite d'écoute musicale pour aujourd'hui. Reviens demain, ou augmente-la dans les réglages.",
        );
        return;
      }
      quotaTickRef.current = null;
      setCurrentTrack(track);
      setIsBuffering(true);
      setPosition(0);
      setDuration(0);

      const uri = await getPlaybackUri(track);
      // Une autre piste a été demandée entre-temps : on abandonne ce chargement.
      if (currentTrackRef.current?.id !== track.id) return;
      if (!uri) {
        setIsBuffering(false);
        return;
      }
      try {
        await player.replaceAsync({
          uri,
          metadata: { title: track.title, artist: track.artist, artwork: track.coverArtUrl },
        });
        if (currentTrackRef.current?.id !== track.id) return;
        player.play();
        recordMusicPlayed(track);
        prefetchNextTrack(track);
      } catch {
        // Flux hors-ligne indisponible ou expiré : on laisse la piste "en pause".
      } finally {
        setIsBuffering(false);
      }
    },
    [player, getPlaybackUri, prefetchNextTrack],
  );

  const playTrack = useCallback(
    (track: MusicTrack, newQueue: MusicTrack[]) => {
      setRadioEnabled(false);
      setQueue(newQueue);
      loadAndPlay(track);
    },
    [loadAndPlay],
  );

  // Étend la file avec le Mix YouTube ("radio") de `seedId` : dédoublonne
  // contre la file actuelle (le Mix renvoie souvent la piste de départ et des
  // voisines déjà connues) et renvoie les morceaux effectivement ajoutés,
  // pour que l'appelant puisse enchaîner la lecture dessus immédiatement.
  const extendRadioQueue = useCallback(async (seedId: string): Promise<MusicTrack[]> => {
    setRadioLoading(true);
    try {
      const related = await getRadioQueue(seedId);
      const existingIds = new Set(queueRef.current.map((t) => t.id));
      const additions = related
        .filter((v) => v.id !== seedId && !existingIds.has(v.id))
        .map(radioTrackToMusicTrack);
      if (additions.length > 0) {
        setQueue((prev) => [...prev, ...additions]);
      }
      return additions;
    } catch {
      return [];
    } finally {
      setRadioLoading(false);
    }
  }, []);

  const toggleRadio = useCallback(() => {
    if (radioEnabledRef.current) {
      setRadioEnabled(false);
      return;
    }
    setRadioEnabled(true);
    const cur = currentTrackRef.current;
    if (cur) extendRadioQueue(cur.id);
  }, [extendRadioQueue]);

  const stepQueue = useCallback(
    async (direction: 1 | -1) => {
      const q = queueRef.current;
      const cur = currentTrackRef.current;
      if (q.length === 0 || !cur) return;

      if (shuffleRef.current && q.length > 1) {
        let randomIdx = Math.floor(Math.random() * q.length);
        const curIdx = q.findIndex((t) => t.id === cur.id);
        if (randomIdx === curIdx) randomIdx = (randomIdx + 1) % q.length;
        loadAndPlay(q[randomIdx]);
        return;
      }

      const idx = q.findIndex((t) => t.id === cur.id);
      if (idx === -1) return;
      let nextIdx = idx + direction;

      // File épuisée en avançant, radio active : on la prolonge plutôt que de
      // s'arrêter ou de reboucler — c'est tout l'intérêt du mode radio.
      if (nextIdx >= q.length && direction === 1 && radioEnabledRef.current) {
        const additions = await extendRadioQueue(cur.id);
        if (additions.length > 0) {
          loadAndPlay(additions[0]);
          return;
        }
      }

      if (nextIdx < 0) nextIdx = repeatRef.current === 'all' ? q.length - 1 : -1;
      if (nextIdx >= q.length) nextIdx = repeatRef.current === 'all' ? 0 : -1;

      if (nextIdx === -1) {
        player.pause();
        return;
      }
      loadAndPlay(q[nextIdx]);
    },
    [loadAndPlay, player, extendRadioQueue],
  );

  const playNext = useCallback(() => stepQueue(1), [stepQueue]);

  // Comme Spotify : "précédent" redémarre la piste courante si on est déjà
  // un peu avancé dedans, sinon passe vraiment à la piste précédente.
  const playPrevious = useCallback(() => {
    if (positionRef.current > 3) {
      player.currentTime = 0;
      setPosition(0);
      return;
    }
    stepQueue(-1);
  }, [player, stepQueue]);

  const togglePlay = useCallback(() => {
    if (!currentTrackRef.current) return;
    if (player.playing) player.pause();
    else if (!musicQuotaExceededRef.current) player.play();
  }, [player]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.currentTime = seconds;
      setPosition(seconds);
    },
    [player],
  );

  const toggleShuffle = useCallback(() => setShuffle((v) => !v), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerEndsAt(minutes ? Date.now() + minutes * 60_000 : null);
  }, []);

  // Minuterie de mise en veille : décompte à la seconde, coupe la lecture
  // (sans changer de piste) quand l'échéance est atteinte.
  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setSleepTimerRemaining(null);
      return;
    }
    const tick = () => {
      const remaining = Math.round((sleepTimerEndsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        player.pause();
        setSleepTimerEndsAt(null);
        setSleepTimerRemaining(null);
      } else {
        setSleepTimerRemaining(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, player]);

  useEffect(() => {
    const playToEndSub = player.addListener('playToEnd', () => {
      if (repeatRef.current === 'one') {
        player.currentTime = 0;
        player.play();
        return;
      }
      stepQueue(1);
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
      setPosition(currentTime);
      if (player.duration > 0) setDuration(player.duration);

      const now = Date.now();
      if (quotaTickRef.current !== null) {
        addMusicListenSeconds((now - quotaTickRef.current) / 1000);
      }
      quotaTickRef.current = now;
    });

    return () => {
      playToEndSub.remove();
      playingSub.remove();
      timeSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // Dès que le quota bascule en dépassé (y compris en cours de lecture), on
  // coupe le son : le blocage ne doit pas attendre une action de l'utilisateur.
  useEffect(() => {
    if (musicQuotaExceeded) player.pause();
  }, [musicQuotaExceeded, player]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      isPlaying,
      isBuffering,
      position,
      duration,
      shuffle,
      repeat,
      sleepTimerRemaining,
      radioEnabled,
      radioLoading,
      playTrack,
      togglePlay,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      cycleRepeat,
      setSleepTimer,
      toggleRadio,
    }),
    [
      currentTrack,
      queue,
      isPlaying,
      isBuffering,
      position,
      duration,
      shuffle,
      repeat,
      sleepTimerRemaining,
      radioEnabled,
      radioLoading,
      playTrack,
      togglePlay,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      cycleRepeat,
      setSleepTimer,
      toggleRadio,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Vue native hors-écran : garde le player audio actif en arrière-plan
          et alimente la notification "En cours de lecture" du verrouillage. */}
      <VideoView player={player} style={styles.hidden} nativeControls={false} contentFit="contain" />
    </PlayerContext.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
  },
});

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer() doit être utilisé sous <PlayerProvider>');
  return ctx;
}
