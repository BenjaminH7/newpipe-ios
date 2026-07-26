// Fabrique de petits stores persistés AsyncStorage avec le même schéma
// pub/sub que src/storage/savedVideos.ts & co, pour éviter de recopier le
// boilerplate à chaque nouvelle collection de la bibliothèque musicale
// (albums enregistrés, playlists...).
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ListStore<T> {
  getSync: () => T[];
  load: () => Promise<T[]>;
  /** `false` tant que le premier load() n'a pas abouti : permet de distinguer
   *  « collection vide » de « pas encore lue depuis le disque ». */
  isLoaded: () => boolean;
  has: (id: string) => boolean;
  add: (item: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (item: T) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  replaceAll: (items: T[]) => Promise<void>;
  subscribe: (listener: (items: T[]) => void) => () => void;
}

export function createListStore<T>(storageKey: string, getId: (item: T) => string): ListStore<T> {
  let cache: T[] = [];
  let loaded = false;
  let loadPromise: Promise<T[]> | null = null;
  const listeners = new Set<(items: T[]) => void>();

  function notify() {
    for (const listener of listeners) listener(cache);
  }

  async function persist() {
    await AsyncStorage.setItem(storageKey, JSON.stringify(cache));
  }

  const store: ListStore<T> = {
    getSync: () => cache,
    isLoaded: () => loaded,
    load() {
      if (loaded) return Promise.resolve(cache);
      if (loadPromise) return loadPromise;
      loadPromise = AsyncStorage.getItem(storageKey)
        .then((raw) => {
          cache = raw ? (JSON.parse(raw) as T[]) : [];
          loaded = true;
          notify();
          return cache;
        })
        .catch(() => {
          cache = [];
          loaded = true;
          return cache;
        });
      return loadPromise;
    },
    has: (id) => cache.some((item) => getId(item) === id),
    async add(item) {
      if (store.has(getId(item))) return;
      cache = [item, ...cache];
      notify();
      await persist();
    },
    async remove(id) {
      if (!store.has(id)) return;
      cache = cache.filter((item) => getId(item) !== id);
      notify();
      await persist();
    },
    async toggle(item) {
      if (store.has(getId(item))) await store.remove(getId(item));
      else await store.add(item);
    },
    async update(id, patch) {
      if (!store.has(id)) return;
      cache = cache.map((item) => (getId(item) === id ? { ...item, ...patch } : item));
      notify();
      await persist();
    },
    async replaceAll(items) {
      cache = items;
      notify();
      await persist();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return store;
}
