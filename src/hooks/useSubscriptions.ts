import { useCallback, useEffect, useState } from 'react';
import type { SubscribedChannel } from '@/storage/subscriptions';
import {
  getSubscriptionsSync,
  loadSubscriptions,
  subscribe,
  toggleChannelSubscription,
} from '@/storage/subscriptions';

export function useSubscriptions(): SubscribedChannel[] {
  const [channels, setChannels] = useState<SubscribedChannel[]>(getSubscriptionsSync());

  useEffect(() => {
    loadSubscriptions().then(setChannels);
    return subscribe(setChannels);
  }, []);

  return channels;
}

export function useIsChannelSubscribed(channelId: string): boolean {
  const channels = useSubscriptions();
  return channels.some((c) => c.id === channelId);
}

export function useToggleChannelSubscription(): (channel: SubscribedChannel) => void {
  return useCallback((channel: SubscribedChannel) => {
    toggleChannelSubscription(channel);
  }, []);
}
