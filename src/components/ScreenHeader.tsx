import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

// En-tête d'écran façon Spotify : gros titre ancré sous la zone de statut,
// sous-titre discret optionnel. Les onglets masquent le header natif et
// affichent celui-ci à la place.
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const { colors, sharedStyles } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={sharedStyles.mutedText}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
});
