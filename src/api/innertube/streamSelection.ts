// SPDX-License-Identifier: GPL-3.0-or-later
// Reprend la logique de YoutubeStreamExtractor::buildAndAddItagInfoToList,
// Copyright (C) the NewPipe Authors (github.com/TeamNewPipe/NewPipeExtractor),
// licensed GPL-3.0-or-later. Comme le reste de youtubeclient, ce fichier est
// distribué sous GNU GPLv3-or-later — voir le fichier LICENSE à la racine.
//
// Sélection + résolution des flux DASH adaptatifs (vidéo seule / audio seule)
// d'une réponse `/player`. Port de l'esprit de
// YoutubeStreamExtractor::buildAndAddItagInfoToList (NewPipeExtractor) :
// URL directe si présente, sinon déchiffrement de signature + correctif de
// throttling ; le tout best-effort (une erreur ici ne doit jamais empêcher le
// repli vers le flux muxé garanti).
import { deobfuscateSignature } from './cipher';
import { fixThrottlingInUrl } from './throttling';

interface RawFormat {
  itag: number;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  url?: string;
  cipher?: string;
  signatureCipher?: string;
  audioQuality?: string;
}

export interface DualTrackSource {
  videoUrl: string;
  audioUrl: string;
}

function parseCipher(cipherString: string): Record<string, string> {
  const params = new URLSearchParams(cipherString);
  return Object.fromEntries(params.entries());
}

async function resolveFormatUrl(format: RawFormat, streamingPoToken: string | null): Promise<string> {
  let url: string;
  if (format.url) {
    url = format.url;
  } else {
    const cipherString = format.cipher ?? format.signatureCipher;
    if (!cipherString) throw new Error(`Format ${format.itag} sans URL ni cipher`);
    const cipher = parseCipher(cipherString);
    const signature = await deobfuscateSignature(cipher.s ?? '');
    url = `${cipher.url}&${cipher.sp ?? 'signature'}=${signature}`;
  }
  url = await fixThrottlingInUrl(url);
  if (streamingPoToken) url += `&pot=${encodeURIComponent(streamingPoToken)}`;
  return url;
}

function isPlayableCodec(mimeType: string | undefined, kind: 'video' | 'audio'): boolean {
  if (!mimeType) return false;
  // On privilégie les codecs universellement supportés (H.264 / AAC) plutôt que
  // vp9/av01/opus, pas toujours décodables matériellement sur tous les appareils.
  return kind === 'video' ? mimeType.includes('avc1') : mimeType.includes('mp4a');
}

function pickBest(formats: RawFormat[], kind: 'video' | 'audio'): RawFormat | null {
  const isVideo = kind === 'video';
  const candidates = formats.filter((f) =>
    isVideo ? f.mimeType?.startsWith('video/') : f.mimeType?.startsWith('audio/')
  );
  const preferred = candidates.filter((f) => isPlayableCodec(f.mimeType, kind));
  const pool = preferred.length > 0 ? preferred : candidates;
  if (pool.length === 0) return null;
  return pool.reduce((best, f) => {
    const score = isVideo ? (f.height ?? 0) : (f.bitrate ?? 0);
    const bestScore = isVideo ? (best.height ?? 0) : (best.bitrate ?? 0);
    return score > bestScore ? f : best;
  });
}

/**
 * Choisit et résout la meilleure paire vidéo-seule/audio-seule d'une
 * `streamingData` InnerTube (formats DASH adaptatifs). Renvoie `null` si
 * indisponible ou en cas d'échec de résolution (best-effort).
 */
export async function pickBestAdaptiveSource(
  adaptiveFormats: unknown,
  streamingPoToken: string | null
): Promise<DualTrackSource | null> {
  if (!Array.isArray(adaptiveFormats)) return null;
  const formats = adaptiveFormats as RawFormat[];

  const bestVideo = pickBest(formats, 'video');
  const bestAudio = pickBest(formats, 'audio');
  if (!bestVideo || !bestAudio) return null;

  try {
    const [videoUrl, audioUrl] = await Promise.all([
      resolveFormatUrl(bestVideo, streamingPoToken),
      resolveFormatUrl(bestAudio, streamingPoToken),
    ]);
    return { videoUrl, audioUrl };
  } catch {
    return null;
  }
}
