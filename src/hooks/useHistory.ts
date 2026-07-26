import { useCallback, useEffect, useState } from 'react';
import {
  clearHistory,
  getHistorySync,
  loadHistory,
  removeHistoryEntry,
  subscribe,
  type HistoryEntry,
} from '@/storage/history';

export function useHistory(): HistoryEntry[] {
  const [entries, setEntries] = useState<HistoryEntry[]>(getHistorySync());

  useEffect(() => {
    loadHistory().then(setEntries);
    return subscribe(setEntries);
  }, []);

  return entries;
}

export function useRemoveHistoryEntry(): (kind: HistoryEntry['kind'], id: string) => void {
  return useCallback((kind: HistoryEntry['kind'], id: string) => {
    removeHistoryEntry(kind, id);
  }, []);
}

export function useClearHistory(): () => void {
  return useCallback(() => {
    clearHistory();
  }, []);
}
