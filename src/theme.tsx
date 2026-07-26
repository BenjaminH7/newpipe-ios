// Thème simple et épuré : un seul accent, police système, coins arrondis,
// pas de bordures dures ni de séparateurs. Palettes claire et sombre, choix
// exposé dans les réglages (clair / sombre / système) via useTheme().
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useThemeMode } from '@/hooks/useSettings';

export interface ColorPalette {
  background: string;
  surface: string;
  // Surfaces posées au-dessus d'autres surfaces (mini-player flottant,
  // feuilles) : un cran plus claires en sombre, blanches en clair.
  surfaceElevated: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
}

export const lightColors: ColorPalette = {
  background: '#ffffff',
  surface: '#f3f3f4',
  surfaceElevated: '#ffffff',
  text: '#121212',
  muted: '#64646c',
  border: '#e7e7ea',
  accent: '#ef4444',
  accentText: '#ffffff',
};

// Valeurs calées sur la palette sombre de Spotify : fond #121212 (jamais de
// noir pur, les ombres restent lisibles), surfaces #1e1e1e, texte secondaire
// #b3b3b3.
export const darkColors: ColorPalette = {
  background: '#121212',
  surface: '#1e1e1e',
  surfaceElevated: '#2a2a2a',
  text: '#ffffff',
  muted: '#b3b3b3',
  border: '#2e2e2e',
  accent: '#ef4444',
  accentText: '#ffffff',
};

function createSharedStyles(colors: ColorPalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    text: {
      color: colors.text,
    },
    mutedText: {
      color: colors.muted,
      fontSize: 13,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    buttonText: {
      color: colors.accentText,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    // Titre de section façon Spotify : gras, serré, même taille partout.
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    avatar: {
      backgroundColor: colors.surface,
      borderRadius: 999,
    },
    thumbnail: {
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    // Petites pochettes carrées (rangées de titres, mini-player) : rayon plus
    // serré que les miniatures 16:9, comme sur Spotify.
    coverSmall: {
      backgroundColor: colors.surface,
      borderRadius: 4,
    },
  });
}

type SharedStyles = ReturnType<typeof createSharedStyles>;

interface ThemeContextValue {
  colors: ColorPalette;
  sharedStyles: SharedStyles;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode] = useThemeMode();
  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme ?? 'light') : mode;
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const sharedStyles = useMemo(() => createSharedStyles(colors), [colors]);
  const value = useMemo(() => ({ colors, sharedStyles, scheme }), [colors, sharedStyles, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
