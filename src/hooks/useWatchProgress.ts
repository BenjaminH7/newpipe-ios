import { useEffect, useState } from 'react';
import {
  getVideoProgress,
  loadWatchProgress,
  subscribe,
  type WatchProgress,
} from '@/storage/watchProgress';

export function useWatchProgress(id: string): WatchProgress | null {
  const [progress, setProgress] = useState<WatchProgress | null>(() => getVideoProgress(id));

  useEffect(() => {
    let cancelled = false;
    loadWatchProgress().then(() => {
      if (!cancelled) setProgress(getVideoProgress(id));
    });
    const unsubscribe = subscribe((all) => {
      setProgress(all[id] ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);

  return progress;
}
