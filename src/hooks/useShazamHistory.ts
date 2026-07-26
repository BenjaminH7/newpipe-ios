import { useCallback, useEffect, useState } from 'react';
import {
  clearShazamHistory,
  getShazamHistorySync,
  loadShazamHistory,
  removeShazamEntry,
  subscribe,
  type ShazamHistoryEntry,
} from '@/storage/shazamHistory';

export function useShazamHistory(): ShazamHistoryEntry[] {
  const [entries, setEntries] = useState<ShazamHistoryEntry[]>(getShazamHistorySync());

  useEffect(() => {
    loadShazamHistory().then(setEntries);
    return subscribe(setEntries);
  }, []);

  return entries;
}

export function useRemoveShazamEntry(): (id: string) => void {
  return useCallback((id: string) => {
    removeShazamEntry(id);
  }, []);
}

export function useClearShazamHistory(): () => void {
  return useCallback(() => {
    clearShazamHistory();
  }, []);
}
