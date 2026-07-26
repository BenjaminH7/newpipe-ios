import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { checkForNewReleases } from '@/api/newReleases';
import type { ReleaseFeedItem } from '@/storage/releasesFeed';
import { getReleasesFeedSync, loadReleasesFeed, subscribe } from '@/storage/releasesFeed';

export function useReleasesFeed(): ReleaseFeedItem[] {
  const [items, setItems] = useState<ReleaseFeedItem[]>(getReleasesFeedSync());

  useEffect(() => {
    loadReleasesFeed().then(setItems);
    return subscribe(setItems);
  }, []);

  return items;
}

// Nombre de sorties pas encore vues (badge de la cloche sur l'onglet Musique).
export function useUnseenReleasesCount(): number {
  const items = useReleasesFeed();
  return items.reduce((count, i) => (i.seen ? count : count + 1), 0);
}

// Monté une fois dans le layout racine : vérifie les nouveautés au démarrage,
// puis à chaque retour de l'app au premier plan (throttlé côté checker pour ne
// pas frapper Deezer à chaque aller-retour).
export function useNewReleasesAutoCheck(): void {
  useEffect(() => {
    checkForNewReleases({ force: true });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForNewReleases();
    });
    return () => sub.remove();
  }, []);
}
