// Coquille commune des feuilles qui remontent du bas (menu d'un titre, choix
// d'une playlist, ajout de titres) : fond assombri, poignée, en-tête optionnel.
// Les écrans n'ont ainsi qu'à décrire leur contenu, et toutes les feuilles
// gardent les mêmes rayons, marges et hauteurs.
import { useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ColorPalette } from '@/theme';

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  header,
  /** `maxHeight` laisse la feuille se dimensionner sur son contenu ; passer
   *  `height` quand elle embarque une liste défilante. */
  height,
  // Une hauteur fixe est déjà un plafond : ne pas la rogner avec le maximum
  // par défaut prévu pour les feuilles qui se dimensionnent sur leur contenu.
  maxHeight = height === undefined ? '78%' : undefined,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Remplace le bloc titre/sous-titre (en-tête riche avec pochette). */
  header?: ReactNode;
  height?: DimensionValue;
  maxHeight?: DimensionValue;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* La feuille est ancrée en bas : sans ça, le clavier d'un champ de
          recherche recouvrirait la liste et le bouton de validation. */}
      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { height, maxHeight, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          {header ??
            (title ? (
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            ) : null)}
          {children}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetRow({
  icon,
  label,
  detail,
  highlighted = false,
  destructive = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  detail?: string;
  highlighted?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tint = destructive ? '#ef4444' : highlighted ? colors.accent : colors.text;

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={tint} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: {
      gap: 3,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    pressed: {
      opacity: 0.6,
    },
    rowText: {
      flex: 1,
      gap: 1,
    },
    rowLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    rowDetail: {
      color: colors.muted,
      fontSize: 12,
    },
  });
}
