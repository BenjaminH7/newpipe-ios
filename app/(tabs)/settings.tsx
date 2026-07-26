import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSkipProductPlacements, useTextOnlyMode } from '@/hooks/useSettings';
import { colors, sharedStyles } from '@/theme';

function SettingRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[sharedStyles.text, styles.rowTitle]}>{title}</Text>
        <Text style={sharedStyles.mutedText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [textOnlyMode, setTextOnlyMode] = useTextOnlyMode();
  const [skipProductPlacements, setSkipProductPlacements] = useSkipProductPlacements();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Recherche</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <SettingRow
          title="Mode Texte Uniquement"
          description="Cache les miniatures dans les résultats de recherche et les remplace par un carré gris avec la durée, pour éviter le putaclic."
          value={textOnlyMode}
          onValueChange={setTextOnlyMode}
        />
      </View>

      <Text style={styles.sectionTitle}>Lecture</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <SettingRow
          title="Passer les placements de produit"
          description="Saute automatiquement les segments de placement de produit détectés via SponsorBlock."
          value={skipProductPlacements}
          onValueChange={setSkipProductPlacements}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});
