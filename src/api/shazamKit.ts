// Reconnaissance musicale via ShazamKit (framework Apple, iOS 15+). Le module
// natif n'existe que dans un binaire compilé avec expo-shazamkit : Expo Go ne
// l'embarque pas et la lib ne supporte pas Android. On accède au module via
// requireOptionalNativeModule (même garde que le flou de la tab bar) plutôt
// que par le wrapper JS du paquet, qui repose sur NativeModulesProxy, déprécié
// dans expo-modules-core.
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { MatchedItem } from 'expo-shazamkit';

export type { MatchedItem };

interface ShazamKitNativeModule {
  isAvailable(): boolean;
  startListening(): Promise<MatchedItem[]>;
  stopListening(): void;
}

const native = requireOptionalNativeModule<ShazamKitNativeModule>('ExpoShazamKit');

export const shazamAvailable = native !== null;

export type RecognitionResult =
  | { status: 'match'; item: MatchedItem }
  | { status: 'no-match' }
  | { status: 'timeout' };

// Si le micro est refusé, le module natif ne règle jamais sa promesse (son
// callback de permission sort sans resolve ni reject) : on borne donc
// l'attente nous-mêmes. Le délai laisse le temps de répondre à la demande de
// permission iOS puis de capter assez d'audio pour un match (~10 s).
const LISTEN_TIMEOUT_MS = 25_000;

export async function recognizeOnce(): Promise<RecognitionResult> {
  if (!native) throw new Error('ShazamKit est indisponible dans ce binaire.');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<RecognitionResult>((resolve) => {
    timer = setTimeout(() => {
      native.stopListening();
      resolve({ status: 'timeout' });
    }, LISTEN_TIMEOUT_MS);
  });

  const listen = native.startListening().then(
    (items): RecognitionResult =>
      items.length > 0 ? { status: 'match', item: items[0] } : { status: 'no-match' },
    (error: unknown): RecognitionResult => {
      // Le module rejette avec NoMatchException quand ShazamKit a analysé la
      // séquence sans rien reconnaître : c'est un résultat, pas une erreur.
      if (error instanceof Error && error.message.includes('Could not find a match')) {
        return { status: 'no-match' };
      }
      throw error;
    },
  );

  try {
    return await Promise.race([listen, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Coupe l'écoute en cours. La promesse de startListening ne se règle alors
// jamais : l'appelant doit invalider lui-même l'attente (compteur de requête).
export function cancelRecognition(): void {
  native?.stopListening();
}
