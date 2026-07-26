// Pastille "E" des titres explicites, comme sur YouTube Music.
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

export function ExplicitBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.muted }]}>
      <Text style={[styles.label, { color: colors.background }]}>E</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
});
