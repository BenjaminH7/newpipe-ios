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
import {
  addRemoteTrackListeners,
  refreshRemoteCommands,
} from '../../modules/now-playing-controls';
import { getRadioQueue, getVideoInfo, type VideoSummary } from '@/api/youtube';
import { getMusicRadioQueue } from '@/api/ytmusic/client';
import { songsToTracks } from '@/api/ytmusic/convert';
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
  /** `options.radio` : prolonge automatiquement la file une fois épuisée. */
  playTrack: (track: MusicTrack, queue: MusicTrack[], options?: { radio?: boolean }) => void;
  /** Lit un titre seul et remplit la file avec sa radio YouTube Music. */
  playTrackRadio: (track: MusicTrack) => void;
  /** Insère un titre juste après la piste en cours (« Lire ensuite »). */
  enqueueNext: (track: MusicTrack) => void;
  /** Ajoute un titre en fin de file. */
  enqueueLast: (track: MusicTrack) => void;
  /** Saute à un titre déjà présent dans la file (écran « File d'attente »). */
  playFromQueue: (track: MusicTrack) => void;
  /** Retire un titre de la file ; sans effet sur la piste en cours. */
  removeFromQueue: (trackId: string) => void;
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

// Les URL de flux YouTube sont signées et expirent (paramètre `expire`, lié à
// l'IP) : au-delà de cette durée on re-résout un flux frais plutôt que de
// servir une URL morte du cache. Les fichiers locaux, eux, se re-résolvent
// instantanément, donc un TTL uniforme ne coûte rien.
const PLAYBACK_URI_TTL_MS = 45 * 60_000;
const PLAYBACK_URI_CACHE_MAX = 8;

// Piste locale si déjà téléchargée (lecture hors-ligne) ; sinon on retente un
// flux audio frais auprès de YouTube (best-effort, nécessite le réseau).
// Repli quand la radio YouTube Music est indisponible : le Mix YouTube
// classique n'expose pas de fiche artiste, le nom de la chaîne fait au mieux.
function radioVideoToTrack(video: VideoSummary): MusicTrack {
  return {
    id: video.id,
    title: video.title,
    artist: video.channelName || 'YouTube',
    coverArtUrl: video.thumbnail,
    duration: video.duration,
    addedAt: Date.now(),
    localUri: null,
    downloadStatus: 'downloaded',
  };
}

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

  // Seek en attente : après `player.currentTime = x`, le player continue
  // d'émettre quelques timeUpdate avec l'ancienne position tant que le seek
  // n'est pas effectif (flux distant : jusqu'à ~1 s). Sans ce garde-fou, la
  // barre de progression saute en arrière puis revient — le "snap-back"
  // classique. On ignore donc les positions périmées jusqu'à ce que le player
  // ait rejoint la cible (avec une échéance de secours si le seek échoue).
  const pendingSeekRef = useRef<{ target: number; until: number } | null>(null);

  // Cache les résolutions de flux en cours/terminées par identifiant de
  // piste. Sert à la fois à dédoublonner les appels concurrents et à
  // préparer le flux de la piste suivante pendant que la piste courante
  // joue encore (resolvePlaybackUri passe par plusieurs requêtes réseau et
  // la WebView BotGuard, plusieurs secondes) : sans ça, chaque transition
  // attend tout ce pipeline à froid, d'où le "lag" au changement de piste.
  // Chaque entrée porte une échéance (voir PLAYBACK_URI_TTL_MS) et l'accès
  // rafraîchit sa recence : l'éviction retire bien la moins récemment utilisée.
  const playbackUriCache = useRef(
    new Map<string, { promise: Promise<string | null>; expiresAt: number }>(),
  ).current;

  const getPlaybackUri = useCallback(
    (track: MusicTrack): Promise<string | null> => {
      const cached = playbackUriCache.get(track.id);
      if (cached && cached.expiresAt > Date.now()) {
        playbackUriCache.delete(track.id);
        playbackUriCache.set(track.id, cached);
        return cached.promise;
      }
      const promise = resolvePlaybackUri(track).then((uri) => {
        // Échec : on ne garde pas l'échec en cache pour permettre une
        // nouvelle tentative (réseau temporairement indisponible, etc.).
        if (uri === null && playbackUriCache.get(track.id)?.promise === promise) {
          playbackUriCache.delete(track.id);
        }
        return uri;
      });
      playbackUriCache.set(track.id, { promise, expiresAt: Date.now() + PLAYBACK_URI_TTL_MS });
      if (playbackUriCache.size > PLAYBACK_URI_CACHE_MAX) {
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
      if (!next || next.id === fromTrack.id) return;
      // L'étape lente (résolution du flux YouTube) se fait pendant que la
      // piste courante joue encore.
      getPlaybackUri(next);
    },
    [getPlaybackUri],
  );

  // Jeton d'annulation des chargements : chaque loadAndPlay invalide le
  // précédent. Un simple comparatif d'identifiants ne suffirait pas, car la
  // ref de piste courante (synchronisée par effet) peut être en retard sur un
  // await qui se résout en microtâche depuis le cache.
  const loadTokenRef = useRef(0);

  // Pistes déjà jouées depuis le début de la file courante. Sert au mode
  // aléatoire pour savoir quand la file a fait le tour : le tirage au sort ne
  // rencontre jamais « la fin de la file » qui déclencherait l'extension radio.
  const playedIdsRef = useRef<Set<string>>(new Set());

  const loadAndPlay = useCallback(
    async (track: MusicTrack) => {
      if (musicQuotaExceededRef.current) {
        Alert.alert(
          "Limite atteinte",
          "Tu as atteint ta limite d'écoute musicale pour aujourd'hui. Reviens demain, ou augmente-la dans les réglages.",
        );
        return;
      }
      const token = ++loadTokenRef.current;
      quotaTickRef.current = null;
      pendingSeekRef.current = null;
      playedIdsRef.current.add(track.id);
      setCurrentTrack(track);
      setIsBuffering(true);
      setPosition(0);
      setDuration(0);

      const uri = await getPlaybackUri(track);
      // Une autre piste a été demandée entre-temps : on abandonne ce chargement.
      if (loadTokenRef.current !== token) return;
      if (!uri) {
        setIsBuffering(false);
        return;
      }
      try {
        await player.replaceAsync({
          uri,
          metadata: { title: track.title, artist: track.artist, artwork: track.coverArtUrl },
        });
        if (loadTokenRef.current !== token) return;
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

  // `options.radio` : la file fournie n'est qu'un point de départ, à prolonger
  // automatiquement une fois épuisée (bouton radio d'une page artiste). Sans
  // ça, une « radio » s'arrêterait net au bout de ses 50 titres.
  const playTrack = useCallback(
    (track: MusicTrack, newQueue: MusicTrack[], options?: { radio?: boolean }) => {
      setRadioEnabled(options?.radio ?? false);
      setQueue(newQueue);
      // Synchronisation immédiate : prefetchNextTrack lit cette ref dès la fin
      // de loadAndPlay, avant que l'effet de synchronisation n'ait tourné.
      queueRef.current = newQueue;
      playedIdsRef.current = new Set();
      loadAndPlay(track);
    },
    [loadAndPlay],
  );

  // Étend la file avec la radio du titre `seedId` : d'abord la vraie file
  // YouTube Music (endpoint next, playlist RDAMVM — mêmes suggestions et
  // métadonnées propres que le mode radio de Metrolist), sinon repli sur le
  // Mix YouTube classique. Dédoublonne contre la file actuelle et renvoie les
  // morceaux effectivement ajoutés, pour que l'appelant puisse enchaîner la
  // lecture dessus immédiatement.
  const extendRadioQueue = useCallback(async (seedId: string): Promise<MusicTrack[]> => {
    setRadioLoading(true);
    try {
      let related: MusicTrack[];
      try {
        related = songsToTracks(await getMusicRadioQueue(seedId));
      } catch {
        related = (await getRadioQueue(seedId)).map(radioVideoToTrack);
      }
      const existingIds = new Set(queueRef.current.map((t) => t.id));
      const additions = related.filter((v) => v.id !== seedId && !existingIds.has(v.id));
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

  // Lecture "à la YouTube Music" d'un titre isolé (accueil, recherche...) :
  // le titre démarre tout de suite, la file se remplit derrière avec sa radio.
  const playTrackRadio = useCallback(
    (track: MusicTrack) => {
      setRadioEnabled(true);
      setQueue([track]);
      queueRef.current = [track];
      playedIdsRef.current = new Set();
      loadAndPlay(track);
      extendRadioQueue(track.id);
    },
    [loadAndPlay, extendRadioQueue],
  );

  // « Lire ensuite » : insère après la piste en cours (ou remplace la file si
  // rien ne joue). Déjà présent dans la file : on le déplace plutôt que de le
  // dupliquer, comme Metrolist.
  const enqueueNext = useCallback(
    (track: MusicTrack) => {
      const cur = currentTrackRef.current;
      if (!cur) {
        setQueue([track]);
        queueRef.current = [track];
        loadAndPlay(track);
        return;
      }
      if (track.id === cur.id) return;
      setQueue((prev) => {
        const without = prev.filter((t) => t.id !== track.id);
        const idx = without.findIndex((t) => t.id === cur.id);
        const next = [...without];
        next.splice(idx + 1, 0, track);
        return next;
      });
    },
    [loadAndPlay],
  );

  const enqueueLast = useCallback(
    (track: MusicTrack) => {
      const cur = currentTrackRef.current;
      if (!cur) {
        setQueue([track]);
        queueRef.current = [track];
        loadAndPlay(track);
        return;
      }
      setQueue((prev) => (prev.some((t) => t.id === track.id) ? prev : [...prev, track]));
    },
    [loadAndPlay],
  );

  // Saut direct depuis l'écran « File d'attente » : contrairement à playTrack,
  // la file et le mode radio restent tels quels — on ne fait que déplacer le
  // curseur de lecture dedans.
  const playFromQueue = useCallback(
    (track: MusicTrack) => {
      if (track.id === currentTrackRef.current?.id) return;
      loadAndPlay(track);
    },
    [loadAndPlay],
  );

  // Retirer la piste en cours de la file laisserait le lecteur sans repère
  // pour calculer la suivante : on la protège.
  const removeFromQueue = useCallback((trackId: string) => {
    if (trackId === currentTrackRef.current?.id) return;
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const stepQueue = useCallback(
    async (direction: 1 | -1) => {
      const q = queueRef.current;
      const cur = currentTrackRef.current;
      if (q.length === 0 || !cur) return;

      // Lecture aléatoire : on tire parmi les titres pas encore joués, pour
      // faire le tour de la file avant d'en répéter un. Un tirage uniforme sur
      // toute la file ne rencontrerait jamais « la fin », ce qui empêcherait la
      // radio d'aller chercher de nouveaux titres.
      if (shuffleRef.current && q.length > 1) {
        const unplayed = q.filter((t) => t.id !== cur.id && !playedIdsRef.current.has(t.id));
        if (unplayed.length > 0) {
          loadAndPlay(unplayed[Math.floor(Math.random() * unplayed.length)]);
          return;
        }
        // Tour complet : la radio prolonge la file, sinon on repart pour un
        // nouveau tour sur les mêmes titres.
        if (direction === 1 && radioEnabledRef.current) {
          const additions = await extendRadioQueue(cur.id);
          if (additions.length > 0) {
            loadAndPlay(additions[Math.floor(Math.random() * additions.length)]);
            return;
          }
        }
        playedIdsRef.current = new Set();
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

  const seekTo = useCallback(
    (seconds: number) => {
      pendingSeekRef.current = { target: seconds, until: Date.now() + 3000 };
      player.currentTime = seconds;
      setPosition(seconds);
    },
    [player],
  );

  // Comme Spotify : "précédent" redémarre la piste courante si on est déjà
  // un peu avancé dedans, sinon passe vraiment à la piste précédente.
  const playPrevious = useCallback(() => {
    if (positionRef.current > 3) {
      seekTo(0);
      return;
    }
    stepQueue(-1);
  }, [seekTo, stepQueue]);

  const togglePlay = useCallback(() => {
    if (!currentTrackRef.current) return;
    if (player.playing) player.pause();
    else if (!musicQuotaExceededRef.current) player.play();
  }, [player]);

  // Écran verrouillé / Centre de contrôle : les boutons « précédent » et
  // « suivant » changent de piste au lieu de reculer/avancer de 10 s. Sans le
  // module natif (Expo Go, Android), addRemoteTrackListeners est un no-op.
  useEffect(() => addRemoteTrackListeners({
    onNextTrack: playNext,
    onPreviousTrack: playPrevious,
  }), [playNext, playPrevious]);

  // expo-video réenregistre ses commandes de saut à chaque changement de piste.
  useEffect(() => {
    if (currentTrack) refreshRemoteCommands();
  }, [currentTrack]);

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
      const pending = pendingSeekRef.current;
      if (pending) {
        if (Math.abs(currentTime - pending.target) < 1 || Date.now() > pending.until) {
          // Le player a rejoint la cible (ou le seek a expiré) : on reprend
          // le suivi normal de la position.
          pendingSeekRef.current = null;
          setPosition(currentTime);
        }
        // Sinon : tick périmé d'avant-seek, on garde la position affichée
        // sur la cible du seek (le décompte du quota, lui, continue).
      } else {
        setPosition(currentTime);
      }
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
      playTrackRadio,
      enqueueNext,
      enqueueLast,
      playFromQueue,
      removeFromQueue,
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
      playTrackRadio,
      enqueueNext,
      enqueueLast,
      playFromQueue,
      removeFromQueue,
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
