// Cible des deep links `youtubeclient://play/<id>`, émis par les widgets iOS
// quand on tape une pochette. Cet écran ne s'affiche qu'un instant : il
// retrouve la piste dans l'historique, la lance, puis cède la place au lecteur.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyView, LoadingView } from '@/components/StatusView';
import { usePlayer } from '@/player/PlayerContext';
import { loadHistory } from '@/storage/history';
import type { MusicTrack } from '@/storage/musicLibrary';
import { useTheme } from '@/theme';

export default function PlayDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sharedStyles } = useTheme();
  const { playTrack } = usePlayer();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    loadHistory().then((entries) => {
      if (cancelled) return;

      const tracks: MusicTrack[] = entries
        .filter((entry) => entry.kind === 'music')
        .map((entry) => (entry as Extract<typeof entry, { kind: 'music' }>).track);
      const track = tracks.find((t) => t.id === id);

      if (!track) {
        setNotFound(true);
        return;
      }

      // La file reprend l'historique récent : après le titre tapé, la lecture
      // continue au lieu de s'arrêter net.
      playTrack(track, tracks);
      // replace() plutôt que push() : cet écran ne doit pas rester dans la
      // pile, sinon le retour depuis le lecteur y revient et relance la piste.
      router.replace('/(tabs)');
      router.push('/music/player');
    });

    return () => {
      cancelled = true;
    };
  }, [id, playTrack, router]);

  return (
    <View style={sharedStyles.screen}>
      <Stack.Screen options={{ title: '' }} />
      {notFound ? (
        <EmptyView
          icon="musical-notes-outline"
          title="Titre introuvable"
          message="Il n’est plus dans ton historique d’écoute."
        />
      ) : (
        <LoadingView />
      )}
    </View>
  );
}
