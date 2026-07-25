// Thème simple et épuré : fond blanc, texte quasi-noir, un seul accent,
// police système, coins arrondis, pas de bordures dures ni de séparateurs.
import { StyleSheet } from 'react-native';

export const colors = {
  background: '#ffffff',
  surface: '#f4f4f5',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  accent: '#ef4444',
  accentText: '#ffffff',
};

export const sharedStyles = StyleSheet.create({
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
    borderRadius: 12,
    paddingHorizontal: 16,
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
});
