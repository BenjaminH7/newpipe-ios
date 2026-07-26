import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  useMusicQuotaMinutes,
  useSkipProductPlacements,
  useTextOnlyMode,
  useVideoQuotaMinutes,
} from '@/hooks/useSettings';
import { colors, sharedStyles } from '@/theme';

const MIN_QUOTA_MINUTES = 1;
const MAX_QUOTA_MINUTES = 600;

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

// Champ minutes avec état local : on laisse l'utilisateur taper/effacer
// librement, et on ne répercute (+ clamp) vers le stockage qu'à la sortie du
// champ, sinon "3" tapé devant "0" pour écrire "30" se ferait effacer.
function QuotaMinutesRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Math.round(Number(text));
    const clamped = Number.isFinite(parsed)
      ? Math.min(MAX_QUOTA_MINUTES, Math.max(MIN_QUOTA_MINUTES, parsed))
      : value;
    setText(String(clamped));
    if (clamped !== value) onValueChange(clamped);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[sharedStyles.text, styles.rowTitle]}>{title}</Text>
        <Text style={sharedStyles.mutedText}>{description}</Text>
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        style={styles.minutesInput}
        maxLength={3}
      />
      <Text style={sharedStyles.mutedText}>min</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [textOnlyMode, setTextOnlyMode] = useTextOnlyMode();
  const [skipProductPlacements, setSkipProductPlacements] = useSkipProductPlacements();
  const [videoQuotaMinutes, setVideoQuotaMinutes] = useVideoQuotaMinutes();
  const [musicQuotaMinutes, setMusicQuotaMinutes] = useMusicQuotaMinutes();

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

      <Text style={styles.sectionTitle}>Quota de lecture</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <QuotaMinutesRow
          title="Limite vidéo par jour"
          description="Au-delà de cette durée (ou de 3 vidéos), le lecteur vidéo se bloque jusqu'à minuit. Ne compte pas la musique."
          value={videoQuotaMinutes}
          onValueChange={setVideoQuotaMinutes}
        />
        <View style={styles.separator} />
        <QuotaMinutesRow
          title="Limite musique par jour"
          description="Au-delà de cette durée d'écoute, le lecteur musique se bloque jusqu'à minuit. Réglage indépendant de la vidéo."
          value={musicQuotaMinutes}
          onValueChange={setMusicQuotaMinutes}
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  minutesInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 15,
    minWidth: 48,
    textAlign: 'center',
  },
});
