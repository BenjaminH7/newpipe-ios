// Interface JS du module natif iOS `NowPlayingControls` (voir
// ios/NowPlayingControlsModule.swift). Chargé en optionnel : le binaire public
// d'Expo Go ne contient pas ce module, et il n'existe pas sur Android — dans
// ces deux cas tout se dégrade en no-op et l'écran verrouillé garde les
// boutons de saut d'expo-video.
import { requireOptionalNativeModule } from 'expo-modules-core';

interface Subscription {
  remove: () => void;
}

interface NowPlayingControlsNativeModule {
  /** Réaffirme la disponibilité des commandes (piste ↔ saut). */
  refresh: () => void;
  addListener: (
    event: 'onNextTrack' | 'onPreviousTrack',
    listener: () => void,
  ) => Subscription;
}

const NowPlayingControls =
  requireOptionalNativeModule<NowPlayingControlsNativeModule>('NowPlayingControls');

/** `true` si l'écran verrouillé affiche précédent/suivant plutôt que ±10 s. */
export const hasRemoteTrackControls = NowPlayingControls !== null;

/** Branche les boutons piste précédente / suivante ; renvoie un désabonnement. */
export function addRemoteTrackListeners(handlers: {
  onNextTrack: () => void;
  onPreviousTrack: () => void;
}): () => void {
  if (!NowPlayingControls) return () => {};
  const next = NowPlayingControls.addListener('onNextTrack', handlers.onNextTrack);
  const previous = NowPlayingControls.addListener('onPreviousTrack', handlers.onPreviousTrack);
  return () => {
    next.remove();
    previous.remove();
  };
}

export function refreshRemoteCommands(): void {
  NowPlayingControls?.refresh();
}
