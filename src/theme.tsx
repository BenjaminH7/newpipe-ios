// Thème simple et épuré : un seul accent, police système, coins arrondis,
// pas de bordures dures ni de séparateurs. Palettes claire et sombre, choix
// exposé dans les réglages (clair / sombre / système) via useTheme().
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useThemeMode } from '@/hooks/useSettings';

export interface ColorPalette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
}

export const lightColors: ColorPalette = {
  background: '#ffffff',
  surface: '#f4f4f5',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  accent: '#ef4444',
  accentText: '#ffffff',
};

export const darkColors: ColorPalette = {
  background: '#09090b',
  surface: '#18181b',
  text: '#fafafa',
  muted: '#a1a1aa',
  border: '#27272a',
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
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    buttonText: {
      color: colors.accentText,
      fontSize: 14,
      fontWeight: '600',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
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
      borderRadius: 6,
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
