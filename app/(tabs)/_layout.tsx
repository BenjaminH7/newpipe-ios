import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useHidePlaylistsTab, useHideSubscriptionsTab } from '@/hooks/useSettings';
import { useTheme } from '@/theme';

// Le flou natif n'existe que si le binaire qui exécute l'app embarque le
// module ExpoBlurView : Expo Go l'inclut, mais un build EAS/TestFlight
// compilé AVANT l'ajout d'expo-blur au projet ne l'a pas. Sans ce test,
// rendre <BlurView> affiche "Unimplemented component
// <ViewManagerAdapter_ExpoBlurView>" à la place du fond de la tab bar.
const hasNativeBlur = Platform.OS === 'ios' && requireOptionalNativeModule('ExpoBlurView') !== null;

// Tab bar façon Spotify : pas de header natif (chaque écran affiche son
// ScreenHeader), onglet actif dans la couleur du texte plutôt qu'en accent,
// et effet verre : barre translucide posée en absolu, le contenu défile
// dessous à travers un flou natif (BlurView). Android n'a pas de flou natif
// fiable en Expo Go : on retombe sur un fond quasi opaque.
export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  const [hideSubscriptionsTab] = useHideSubscriptionsTab();
  const [hidePlaylistsTab] = useHidePlaylistsTab();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarBackground: () =>
          hasNativeBlur ? (
            <BlurView
              tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
              intensity={90}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.97 }]}
            />
          ),
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rechercher',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Abonnements',
          href: hideSubscriptionsTab ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          href: hidePlaylistsTab ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'albums' : 'albums-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          title: 'Musique',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'musical-notes' : 'musical-notes-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shazam"
        options={{
          title: 'Shazam',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
