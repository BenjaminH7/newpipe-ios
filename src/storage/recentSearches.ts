// Recherches récentes, comme la liste « Récentes » sous la barre de recherche
// de Spotify : les termes déjà cherchés reviennent en un tap au lieu d'être
// retapés en entier.
import { createListStore } from './listStore';

export interface RecentSearch {
  term: string;
  searchedAt: number;
}

const MAX_RECENT_SEARCHES = 8;

export const recentSearchesStore = createListStore<RecentSearch>(
  '@youtubeclient/recentSearches',
  (s) => s.term.toLowerCase(),
);

/** Enregistre un terme validé : dédoublonné, remonté en tête, liste plafonnée. */
export async function recordSearch(term: string): Promise<void> {
  const trimmed = term.trim();
  if (!trimmed) return;
  // remove() avant add() : sans ça, add() ignore un terme déjà connu et
  // l'entrée resterait figée au fond de la liste.
  await recentSearchesStore.remove(trimmed.toLowerCase());
  await recentSearchesStore.add({ term: trimmed, searchedAt: Date.now() });
  const all = recentSearchesStore.getSync();
  if (all.length > MAX_RECENT_SEARCHES) {
    await recentSearchesStore.replaceAll(all.slice(0, MAX_RECENT_SEARCHES));
  }
}

export function forgetSearch(term: string): Promise<void> {
  return recentSearchesStore.remove(term.toLowerCase());
}

export function clearRecentSearches(): Promise<void> {
  return recentSearchesStore.replaceAll([]);
}
