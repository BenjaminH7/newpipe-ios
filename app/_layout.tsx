import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JsEngineView } from '@/api/innertube/JsEngineView';
import { useNewReleasesAutoCheck } from '@/hooks/useReleasesFeed';
import { PlayerProvider } from '@/player/PlayerContext';
import { ThemeProvider, useTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function RootLayoutContent() {
  const { colors, scheme } = useTheme();
  // Nouveautés musicales des artistes suivis : check au lancement puis à
  // chaque retour au premier plan (throttlé côté checker).
  useNewReleasesAutoCheck();

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <JsEngineView />
      <PlayerProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text, fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="video/[id]" options={{ title: '' }} />
          {/* Modal classique plutôt que formSheet : les detents de formSheet
              cassent la hauteur des enfants en flex (la pochette mesurait 0
              et ne s'affichait pas). Le pageSheet iOS garde le glissement et
              le swipe-down façon Spotify ; Android affiche un plein écran.
              Fond forcé en sombre : le player est toujours sombre (pochette
              floutée + voile noir), même en thème clair. */}
          <Stack.Screen
            name="music/player"
            options={{
              headerShown: false,
              presentation: 'modal',
              contentStyle: { backgroundColor: '#121212' },
            }}
          />
          <Stack.Screen name="music/artist" options={{ headerShown: false }} />
          <Stack.Screen name="music/album" options={{ headerShown: false }} />
          <Stack.Screen name="music/releases" options={{ title: 'Nouveautés' }} />
          <Stack.Screen name="history" options={{ title: 'Historique' }} />
          <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
        </Stack>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
