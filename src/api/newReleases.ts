// Détection des nouvelles sorties des artistes suivis : pour chaque artiste,
// on recharge sa page YouTube Music et on compare les albums/singles qui y
// figurent à ceux déjà connus (diff sur les browseIds, voir
// src/storage/followedArtists.ts). Lancée au démarrage, au retour de l'app au
// premier plan (throttlée) et en pull-to-refresh sur l'écran Nouveautés. Pas de
// tâche de fond native : Expo Go ne les exécute pas de façon fiable, le retour
// au premier plan est le meilleur signal disponible sans build custom.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getArtistPage } from '@/api/ytmusic/client';
import { artistNames } from '@/api/ytmusic/convert';
import type { YTAlbum } from '@/api/ytmusic/types';
import {
  loadFollowedArtists,
  recordKnownAlbums,
  type FollowedArtist,
} from '@/storage/followedArtists';
import { addReleases, type ReleaseFeedItem } from '@/storage/releasesFeed';

const LAST_CHECK_KEY = '@youtubeclient/releasesLastCheck';

// Entre deux passages au premier plan rapprochés, inutile de re-frapper
// YouTube Music : les sorties arrivent à l'échelle de la journée, pas de la
// minute.
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;

let inFlight: Promise<void> | null = null;
let lastCheckAt: number | null = null;

async function getLastCheck(): Promise<number> {
  if (lastCheckAt !== null) return lastCheckAt;
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    lastCheckAt = raw ? Number(raw) : 0;
  } catch {
    lastCheckAt = 0;
  }
  return lastCheckAt;
}

async function setLastCheck(timestamp: number): Promise<void> {
  lastCheckAt = timestamp;
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(timestamp));
  } catch {
    // Sans persistance on re-vérifiera au prochain démarrage, sans gravité.
  }
}

/** Tous les albums/singles présents dans les sections de la page artiste. */
export function albumsOfArtistPage(sections: { items: { type: string }[] }[]): YTAlbum[] {
  const albums: YTAlbum[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.type !== 'album') continue;
      const album = item as YTAlbum;
      if (seen.has(album.browseId)) continue;
      seen.add(album.browseId);
      albums.push(album);
    }
  }
  return albums;
}

async function collectArtistReleases(artist: FollowedArtist): Promise<ReleaseFeedItem[]> {
  const page = await getArtistPage(artist.id);
  const albums = albumsOfArtistPage(page.sections);
  if (albums.length === 0) return [];

  const known = new Set(artist.knownAlbumIds);
  const unknown = albums.filter((a) => !known.has(a.browseId));
  if (unknown.length === 0) return [];

  // Tout ce qui a été vu entre au connu : on ne ré-évaluera pas ces albums à
  // chaque passage.
  await recordKnownAlbums(artist.id, albums.map((a) => a.browseId));

  // Premier passage après le suivi : si la baseline avait échoué (réseau
  // coupé au moment du suivi), on ne veut pas déverser toute la discographie
  // dans le fil.
  if (known.size === 0) return [];

  const discoveredAt = Date.now();
  return unknown.map((a) => ({
    albumId: a.browseId,
    artistId: artist.id,
    artistName: artist.name || artistNames(a.artists),
    title: a.title,
    coverUrl: a.thumbnail,
    releaseDate: a.year ?? '',
    discoveredAt,
    seen: false,
  }));
}

async function doCheck(force: boolean): Promise<void> {
  const artists = await loadFollowedArtists();
  if (artists.length === 0) return;

  if (!force) {
    const last = await getLastCheck();
    if (Date.now() - last < MIN_CHECK_INTERVAL_MS) return;
  }

  const results = await Promise.allSettled(artists.map(collectArtistReleases));
  const newItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (newItems.length > 0) await addReleases(newItems);
  await setLastCheck(Date.now());
}

// Une seule vérification à la fois : les déclencheurs (démarrage, premier
// plan, pull-to-refresh) peuvent se chevaucher, les appels concurrents
// partagent la promesse en cours.
export function checkForNewReleases(options: { force?: boolean } = {}): Promise<void> {
  if (!inFlight) {
    inFlight = doCheck(options.force ?? false).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
