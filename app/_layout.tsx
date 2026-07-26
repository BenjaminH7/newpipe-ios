import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JsEngineView } from '@/api/innertube/JsEngineView';
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
          <Stack.Screen
            name="music/player"
            options={{
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.85],
              sheetCornerRadius: 24,
            }}
          />
          <Stack.Screen name="music/artist" options={{ headerShown: false }} />
          <Stack.Screen name="music/album" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ title: 'Historique' }} />
        </Stack>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
