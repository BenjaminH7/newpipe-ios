import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useHideSubscriptionsTab,
  useMusicQuotaMinutes,
  useSkipProductPlacements,
  useTextOnlyMode,
  useThemeMode,
  useTranslateLyrics,
  useVideoQuotaMinutes,
} from '@/hooks/useSettings';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ThemeMode } from '@/storage/settings';
import { useTheme, type ColorPalette } from '@/theme';

const MIN_QUOTA_MINUTES = 1;
const MAX_QUOTA_MINUTES = 600;

type SharedStyles = ReturnType<typeof useTheme>['sharedStyles'];
type Styles = ReturnType<typeof createStyles>;

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  colors,
  sharedStyles,
  styles,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: ColorPalette;
  sharedStyles: SharedStyles;
  styles: Styles;
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
  sharedStyles,
  styles,
}: {
  title: string;
  description: string;
  value: number;
  onValueChange: (value: number) => void;
  sharedStyles: SharedStyles;
  styles: Styles;
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

function NavigationRow({
  title,
  description,
  onPress,
  colors,
  sharedStyles,
  styles,
}: {
  title: string;
  description: string;
  onPress: () => void;
  colors: ColorPalette;
  sharedStyles: SharedStyles;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowText}>
        <Text style={[sharedStyles.text, styles.rowTitle]}>{title}</Text>
        <Text style={sharedStyles.mutedText}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function ThemeModeSelector({
  mode,
  onChange,
  colors,
  styles,
}: {
  mode: ThemeMode;
  onChange: (value: ThemeMode) => void;
  colors: ColorPalette;
  styles: Styles;
}) {
  return (
    <View style={styles.segmentedControl}>
      {THEME_OPTIONS.map((option) => {
        const active = option.value === mode;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.accentText : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [textOnlyMode, setTextOnlyMode] = useTextOnlyMode();
  const [skipProductPlacements, setSkipProductPlacements] = useSkipProductPlacements();
  const [themeMode, setThemeMode] = useThemeMode();
  const [translateLyrics, setTranslateLyrics] = useTranslateLyrics();
  const [videoQuotaMinutes, setVideoQuotaMinutes] = useVideoQuotaMinutes();
  const [musicQuotaMinutes, setMusicQuotaMinutes] = useMusicQuotaMinutes();
  const [hideSubscriptionsTab, setHideSubscriptionsTab] = useHideSubscriptionsTab();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Réglages" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Apparence</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <View style={styles.themeBlock}>
          <Text style={[sharedStyles.text, styles.rowTitle]}>Thème</Text>
          <Text style={sharedStyles.mutedText}>
            Choisis un thème clair ou sombre, ou suis le réglage de ton appareil.
          </Text>
          <ThemeModeSelector mode={themeMode} onChange={setThemeMode} colors={colors} styles={styles} />
        </View>
        <View style={styles.separator} />
        <SettingRow
          title="Mode Texte Uniquement"
          description="Cache les miniatures dans les résultats de recherche et les remplace par un carré gris avec la durée, pour éviter le putaclic."
          value={textOnlyMode}
          onValueChange={setTextOnlyMode}
          colors={colors}
          sharedStyles={sharedStyles}
          styles={styles}
        />
        <View style={styles.separator} />
        <SettingRow
          title="Masquer l'onglet Abonnements"
          description="Retire l'onglet Abonnements de la barre de navigation."
          value={hideSubscriptionsTab}
          onValueChange={setHideSubscriptionsTab}
          colors={colors}
          sharedStyles={sharedStyles}
          styles={styles}
        />
      </View>

      <Text style={styles.sectionTitle}>Lecture</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <SettingRow
          title="Passer les placements de produit"
          description="Saute automatiquement les segments de placement de produit détectés via SponsorBlock."
          value={skipProductPlacements}
          onValueChange={setSkipProductPlacements}
          colors={colors}
          sharedStyles={sharedStyles}
          styles={styles}
        />
        <View style={styles.separator} />
        <SettingRow
          title="Traduire les paroles"
          description="Affiche une traduction en français sous les paroles synchronisées du lecteur musique."
          value={translateLyrics}
          onValueChange={setTranslateLyrics}
          colors={colors}
          sharedStyles={sharedStyles}
          styles={styles}
        />
      </View>

      <Text style={styles.sectionTitle}>Quota de lecture</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <QuotaMinutesRow
          title="Limite vidéo par jour"
          description="Au-delà de cette durée (ou de 3 vidéos), le lecteur vidéo se bloque jusqu'à minuit. Ne compte pas la musique."
          value={videoQuotaMinutes}
          onValueChange={setVideoQuotaMinutes}
          sharedStyles={sharedStyles}
          styles={styles}
        />
        <View style={styles.separator} />
        <QuotaMinutesRow
          title="Limite musique par jour"
          description="Au-delà de cette durée d'écoute, le lecteur musique se bloque jusqu'à minuit. Réglage indépendant de la vidéo."
          value={musicQuotaMinutes}
          onValueChange={setMusicQuotaMinutes}
          sharedStyles={sharedStyles}
          styles={styles}
        />
      </View>

      <Text style={styles.sectionTitle}>Historique</Text>
      <View style={[sharedStyles.card, styles.section]}>
        <NavigationRow
          title="Voir l'historique"
          description="Retrouve les vidéos regardées et les musiques écoutées récemment."
          onPress={() => router.push('/history')}
          colors={colors}
          sharedStyles={sharedStyles}
          styles={styles}
        />
      </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
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
    themeSection: {
      padding: 14,
      gap: 4,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 3,
      marginTop: 10,
      gap: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
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
}
