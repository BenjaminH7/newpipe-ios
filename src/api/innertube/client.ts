// Client InnerTube "fait maison" : recherche et métadonnées via le client WEB
// (fiable, c'est l'infrastructure de youtube.com elle-même — cf. les tests
// qui ont motivé cette réécriture), lecture garantie via l'astuce Android
// "Reel" de NewPipe (getAndroidReelPlayerResponse, aucun poToken requis), et
// tentative best-effort de flux adaptatifs HD via le client WEB + poToken
// (BotGuard) + déchiffrement de signature, avec repli automatique sur le flux
// garanti si cette dernière échoue.
import {
  ANDROID_CLIENT_VERSION,
  ANDROID_USER_AGENT,
  INNERTUBE_API_KEY,
  WEB_CLIENT_VERSION,
  YOUTUBEI_V1_GAPIS_URL,
  YOUTUBEI_V1_URL,
} from './constants';
import { getPlayerCode, getSignatureTimestamp } from './cipher';
import { getPoTokenResult } from './potoken/poToken';
import { pickBestAdaptiveSource, type DualTrackSource } from './streamSelection';

function randomNonce(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const WEB_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://www.youtube.com',
  Referer: 'https://www.youtube.com',
  'X-YouTube-Client-Name': '1',
  'X-YouTube-Client-Version': WEB_CLIENT_VERSION,
  Cookie: 'SOCS=CAE=',
};

function webClientContext(visitorData?: string) {
  return {
    client: {
      clientName: 'WEB',
      clientVersion: WEB_CLIENT_VERSION,
      hl: 'en',
      gl: 'US',
      utcOffsetMinutes: 0,
      ...(visitorData ? { visitorData } : {}),
    },
    request: { internalExperimentFlags: [], useSsl: true, user: { lockedSafetyMode: false } },
  };
}

async function webPost(endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`${YOUTUBEI_V1_URL}${endpoint}?key=${INNERTUBE_API_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: WEB_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} a répondu ${res.status}`);
  return res.json();
}

/** Cherche récursivement toutes les occurrences de `key` dans une structure JSON imbriquée. */
function findAll(obj: unknown, key: string, out: any[] = []): any[] {
  if (Array.isArray(obj)) {
    for (const item of obj) findAll(item, key, out);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === key) out.push(v);
      else findAll(v, key, out);
    }
  }
  return out;
}

function findFirst(obj: unknown, key: string): any {
  return findAll(obj, key)[0] ?? null;
}

function textFrom(node: any): string | null {
  if (!node) return null;
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r: any) => r.text).join('');
  return null;
}

function parseDurationText(text: string | null): number {
  if (!text) return -1;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return -1;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function parseCountText(text: string | null): number {
  if (!text) return -1;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : -1;
}

export interface VideoSummary {
  id: string;
  title: string;
  thumbnail: string;
  channelId: string | null;
  channelName: string;
  channelAvatar: string | null;
  uploadedDate: string | null;
  duration: number;
  views: number;
}

export interface SearchResult {
  items: VideoSummary[];
  nextpage: string | null;
}

/** Extrait le browseId (identifiant stable "UC...") d'un run de texte cliquable vers une chaîne. */
function browseIdFromRuns(node: any): string | null {
  return node?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null;
}

function parseVideoRenderer(vr: any): VideoSummary | null {
  const duration = parseDurationText(textFrom(vr.lengthText));
  if (duration < 0) return null; // exclut lives/premieres (pas de durée) — les Shorts n'apparaissent jamais comme videoRenderer

  const thumbnails = vr.thumbnail?.thumbnails ?? [];
  const thumbnail = thumbnails[thumbnails.length - 1]?.url ?? '';
  const avatarSources =
    vr.avatar?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources ?? [];

  return {
    id: vr.videoId,
    title: textFrom(vr.title) ?? '',
    thumbnail,
    channelId: browseIdFromRuns(vr.ownerText) ?? browseIdFromRuns(vr.longBylineText),
    channelName: textFrom(vr.ownerText) ?? textFrom(vr.longBylineText) ?? '',
    channelAvatar: avatarSources[avatarSources.length - 1]?.url ?? null,
    uploadedDate: textFrom(vr.publishedTimeText),
    duration,
    views: parseCountText(textFrom(vr.viewCountText)),
  };
}

function extractSearchResult(data: any): SearchResult {
  const items = findAll(data, 'videoRenderer')
    .map(parseVideoRenderer)
    .filter((v): v is VideoSummary => v !== null);
  const continuationItem = findFirst(data, 'continuationItemRenderer');
  const nextpage = continuationItem?.continuationEndpoint?.continuationCommand?.token ?? null;
  return { items, nextpage };
}

export async function searchVideos(query: string): Promise<SearchResult> {
  const data = await webPost('search', { context: webClientContext(), query });
  return extractSearchResult(data);
}

export async function searchVideosNextPage(nextpage: string): Promise<SearchResult> {
  const data = await webPost('search', { context: webClientContext(), continuation: nextpage });
  return extractSearchResult(data);
}

/** Trouve, dans la page d'accueil d'une chaîne, les params opaques de l'onglet "Videos". */
function findVideosTabParams(data: any): string | null {
  const tab = findAll(data, 'tabRenderer').find((t) => t.title === 'Videos');
  return tab?.endpoint?.browseEndpoint?.params ?? null;
}

/** Uploads d'une chaîne (onglet "Videos"), utilisés pour construire le flux d'abonnements. */
export async function getChannelUploads(channelId: string): Promise<SearchResult> {
  const home = await webPost('browse', { context: webClientContext(), browseId: channelId });
  const params = findVideosTabParams(home);
  const data = params
    ? await webPost('browse', { context: webClientContext(), browseId: channelId, params })
    : home;
  return extractSearchResult(data);
}

export async function getChannelUploadsNextPage(nextpage: string): Promise<SearchResult> {
  const data = await webPost('browse', { context: webClientContext(), continuation: nextpage });
  return extractSearchResult(data);
}

export interface VideoInfo {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  uploaderId: string;
  uploaderUrl: string;
  uploaderAvatar: string | null;
  uploaderSubscriberCount: number;
  uploaderVerified: boolean;
  category: string;
  views: number;
  likes: number;
  duration: number;
  thumbnailUrl: string;
  livestream: boolean;
}

export type PlayableSource = { kind: 'single'; url: string } | ({ kind: 'dual' } & DualTrackSource);

async function fetchWebMetadata(videoId: string): Promise<{ info: VideoInfo; adaptiveFormats: unknown }> {
  const data = await webPost('player', {
    context: webClientContext(),
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });

  const vd = data.videoDetails ?? {};
  const mf = data.microformat?.playerMicroformatRenderer ?? {};
  const thumbnails = vd.thumbnail?.thumbnails ?? mf.thumbnail?.thumbnails ?? [];

  const info: VideoInfo = {
    title: mf.title?.simpleText ?? vd.title ?? '',
    description: mf.description?.simpleText ?? vd.shortDescription ?? '',
    uploadDate: mf.uploadDate ?? '',
    uploader: mf.ownerChannelName ?? vd.author ?? '',
    uploaderId: '',
    uploaderUrl: mf.ownerProfileUrl ?? '',
    uploaderAvatar: null,
    uploaderSubscriberCount: -1,
    uploaderVerified: false,
    category: mf.category ?? '',
    views: Number(mf.viewCount ?? vd.viewCount ?? -1),
    likes: mf.likeCount !== undefined ? Number(mf.likeCount) : -1,
    duration: Number(vd.lengthSeconds ?? -1),
    thumbnailUrl: thumbnails[thumbnails.length - 1]?.url ?? '',
    livestream: vd.isLiveContent === true,
  };

  return { info, adaptiveFormats: data.streamingData?.adaptiveFormats };
}

async function fetchChannelDetails(
  videoId: string
): Promise<{ channelId: string | null; avatar: string | null; subscriberCount: number; verified: boolean }> {
  try {
    const data = await webPost('next', {
      context: webClientContext(),
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    });
    const owner = findFirst(data, 'videoOwnerRenderer');
    if (!owner) return { channelId: null, avatar: null, subscriberCount: -1, verified: false };
    const avatarSources = owner.thumbnail?.thumbnails ?? [];
    const verified = (owner.badges ?? []).some(
      (b: any) => b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED'
    );
    return {
      channelId: browseIdFromRuns(owner.title),
      avatar: avatarSources[avatarSources.length - 1]?.url ?? null,
      subscriberCount: parseCountText(textFrom(owner.subscriberCountText)),
      verified,
    };
  } catch {
    return { channelId: null, avatar: null, subscriberCount: -1, verified: false };
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later
// La fonction ci-dessous reprend l'astuce "Reel" de
// YoutubeStreamExtractor::getAndroidReelPlayerResponse, Copyright (C) the
// NewPipe Authors (github.com/TeamNewPipe/NewPipeExtractor), licensed
// GPL-3.0-or-later.
/** Astuce Android "Reel" (NewPipe) : lecture garantie sans poToken, plafonnée au format muxé 360p (le seul que YouTube fournit encore en muxé). */
async function fetchGuaranteedPlayback(videoId: string): Promise<PlayableSource | null> {
  try {
    const visitorRes = await fetch(`${YOUTUBEI_V1_GAPIS_URL}visitor_id?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_USER_AGENT,
        'X-Goog-Api-Format-Version': '2',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_CLIENT_VERSION,
            clientScreen: 'WATCH',
            platform: 'MOBILE',
            osName: 'Android',
            osVersion: '16',
            androidSdkVersion: 36,
            hl: 'en',
            gl: 'US',
            utcOffsetMinutes: 0,
          },
        },
      }),
    }).then((r) => r.json());
    const visitorData = visitorRes?.responseContext?.visitorData;

    const t = randomNonce(12);
    const cpn = randomNonce(16);
    const res = await fetch(
      `${YOUTUBEI_V1_GAPIS_URL}reel/reel_item_watch?prettyPrint=false&t=${t}&id=${videoId}&fields=playerResponse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ANDROID_USER_AGENT,
          'X-Goog-Api-Format-Version': '2',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: ANDROID_CLIENT_VERSION,
              clientScreen: 'WATCH',
              platform: 'MOBILE',
              osName: 'Android',
              osVersion: '16',
              androidSdkVersion: 36,
              visitorData,
              hl: 'en',
              gl: 'US',
              utcOffsetMinutes: 0,
            },
          },
          playerRequest: { videoId, cpn, contentCheckOk: true, racyCheckOk: true },
          disablePlayerResponse: false,
        }),
      }
    ).then((r) => r.json());

    const playerResponse = res?.playerResponse;
    const streamingData = playerResponse?.streamingData;
    if (!streamingData) return null;

    if (streamingData.hlsManifestUrl) return { kind: 'single', url: streamingData.hlsManifestUrl };
    const muxed = streamingData.formats?.[0];
    if (muxed?.url) return { kind: 'single', url: muxed.url };
    return null;
  } catch {
    return null;
  }
}

/** Tentative HD best-effort via le client WEB + poToken (BotGuard) + déchiffrement de signature. */
async function fetchHdPlayback(videoId: string, adaptiveFormats: unknown): Promise<PlayableSource | null> {
  try {
    const [poTokenResult, signatureTimestamp] = await Promise.all([
      getPoTokenResult(videoId),
      getSignatureTimestamp(),
    ]);
    await getPlayerCode(); // s'assure que le déchiffreur de signature est prêt

    const data = await webPost('player', {
      context: webClientContext(poTokenResult.visitorData),
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      playbackContext: {
        contentPlaybackContext: {
          signatureTimestamp: signatureTimestamp ? Number(signatureTimestamp) : undefined,
          referer: `https://www.youtube.com/watch?v=${videoId}`,
        },
      },
      serviceIntegrityDimensions: { poToken: poTokenResult.playerRequestPoToken },
    });

    const formats = data.streamingData?.adaptiveFormats ?? adaptiveFormats;
    const dual = await pickBestAdaptiveSource(formats, poTokenResult.streamingDataPoToken);
    return dual ? { kind: 'dual', ...dual } : null;
  } catch {
    return null;
  }
}

export async function getVideoInfo(videoId: string): Promise<{ info: VideoInfo; playable: PlayableSource | null }> {
  const [{ info, adaptiveFormats }, channel, guaranteed] = await Promise.all([
    fetchWebMetadata(videoId),
    fetchChannelDetails(videoId),
    fetchGuaranteedPlayback(videoId),
  ]);

  info.uploaderId = channel.channelId ?? '';
  info.uploaderAvatar = channel.avatar;
  info.uploaderSubscriberCount = channel.subscriberCount;
  info.uploaderVerified = channel.verified;

  let playable = guaranteed;
  if (!info.livestream) {
    const hd = await fetchHdPlayback(videoId, adaptiveFormats);
    if (hd) playable = hd;
  }

  return { info, playable };
}
