import { useEffect, useState } from 'react';
import { recentSearchesStore, type RecentSearch } from '@/storage/recentSearches';

export function useRecentSearches(): RecentSearch[] {
  const [items, setItems] = useState<RecentSearch[]>(recentSearchesStore.getSync());

  useEffect(() => {
    const unsubscribe = recentSearchesStore.subscribe(setItems);
    recentSearchesStore.load();
    return () => {
      unsubscribe();
    };
  }, []);

  return items;
}
