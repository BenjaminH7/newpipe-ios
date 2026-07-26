// Stockage local des chaînes suivies (abonnements), persisté sur l'appareil
// via AsyncStorage. Même pattern pub/sub que src/storage/savedVideos.ts pour
// garder tous les écrans synchronisés sans lib d'état.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SubscribedChannel {
  id: string;
  name: string;
  avatar: string | null;
}

const STORAGE_KEY = '@youtubeclient/subscriptions';

let cache: SubscribedChannel[] = [];
let loaded = false;
let loadPromise: Promise<SubscribedChannel[]> | null = null;
const listeners = new Set<(channels: SubscribedChannel[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getSubscriptionsSync(): SubscribedChannel[] {
  return cache;
}

export function loadSubscriptions(): Promise<SubscribedChannel[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as SubscribedChannel[]) : [];
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
}

export function isChannelSubscribed(id: string): boolean {
  return cache.some((c) => c.id === id);
}

export async function subscribeToChannel(channel: SubscribedChannel): Promise<void> {
  if (!channel.id || isChannelSubscribed(channel.id)) return;
  cache = [channel, ...cache];
  notify();
  await persist();
}

export async function unsubscribeFromChannel(id: string): Promise<void> {
  if (!isChannelSubscribed(id)) return;
  cache = cache.filter((c) => c.id !== id);
  notify();
  await persist();
}

export async function toggleChannelSubscription(channel: SubscribedChannel): Promise<void> {
  if (isChannelSubscribed(channel.id)) await unsubscribeFromChannel(channel.id);
  else await subscribeToChannel(channel);
}

export function subscribe(listener: (channels: SubscribedChannel[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
