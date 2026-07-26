import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JsEngineView } from '@/api/innertube/JsEngineView';
import { PlayerProvider } from '@/player/PlayerContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <JsEngineView />
      <PlayerProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="video/[id]" options={{ title: '' }} />
          <Stack.Screen name="music/player" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
