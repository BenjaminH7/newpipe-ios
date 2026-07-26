import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

// En-tête d'écran façon Spotify : gros titre ancré sous la zone de statut,
// sous-titre discret optionnel. Les onglets masquent le header natif et
// affichent celui-ci à la place. `right` permet de placer une action en haut
// à droite (ex. bouton historique sur l'écran Musique).
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={sharedStyles.mutedText}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  right: {
    marginLeft: 12,
  },
});
