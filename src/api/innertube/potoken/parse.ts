// Port TypeScript de JavaScriptUtil.kt (NewPipe) : décodage des réponses
// brutes des endpoints BotGuard (Create/GenerateIT).
import { asciiStringToBytes, bytesToUrlSafeBase64, youtubeBase64ToBytes } from '../base64';

export interface ChallengeData {
  messageId: string;
  interpreterJavascript: {
    privateDoNotAccessOrElseSafeScriptWrappedValue: string | null;
    privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string | null;
  };
  interpreterHash: string;
  program: string;
  globalName: string;
  clientExperimentsStateBlob: string;
}

function descramble(scrambledChallenge: string): string {
  const bytes = youtubeBase64ToBytes(scrambledChallenge).map((b) => (b + 97) & 0xff);
  return String.fromCharCode(...bytes);
}

/** Décode la réponse de `POST /api/jnn/v1/Create` en objet exploitable par `runBotGuard`. */
export function parseChallengeData(rawChallengeData: string): ChallengeData {
  const scrambled = JSON.parse(rawChallengeData);
  const challengeData =
    scrambled.length > 1 && typeof scrambled[1] === 'string'
      ? JSON.parse(descramble(scrambled[1]))
      : scrambled[0];

  const findString = (arr: unknown): string | null =>
    Array.isArray(arr) ? (arr.find((v) => typeof v === 'string') as string | undefined) ?? null : null;

  return {
    messageId: challengeData[0],
    interpreterJavascript: {
      privateDoNotAccessOrElseSafeScriptWrappedValue: findString(challengeData[1]),
      privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: findString(challengeData[2]),
    },
    interpreterHash: challengeData[3],
    program: challengeData[4],
    globalName: challengeData[5],
    clientExperimentsStateBlob: challengeData[7],
  };
}

/** Décode la réponse de `POST /api/jnn/v1/GenerateIT` en octets d'`integrityToken` + durée de validité. */
export function parseIntegrityTokenData(rawIntegrityTokenData: string): {
  integrityTokenBytes: number[];
  expiresInSeconds: number;
} {
  const arr = JSON.parse(rawIntegrityTokenData);
  return { integrityTokenBytes: youtubeBase64ToBytes(arr[0]), expiresInSeconds: arr[1] };
}

export function stringToU8Literal(identifier: string): number[] {
  return asciiStringToBytes(identifier);
}

/** Convertit les octets d'un poToken (renvoyés par `obtainPoToken`) en la chaîne finale attendue par YouTube. */
export function poTokenBytesToString(bytes: number[]): string {
  return bytesToUrlSafeBase64(bytes);
}
