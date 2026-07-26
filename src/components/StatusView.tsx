import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function LoadingView({ label }: { label?: string }) {
  const { colors, sharedStyles } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={sharedStyles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, sharedStyles } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.muted} />
      <Text style={[sharedStyles.text, styles.message]}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [sharedStyles.button, styles.retryButton, pressed && styles.pressed]}
          onPress={onRetry}
        >
          <Text style={sharedStyles.buttonText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// État vide façon Spotify : icône discrète, titre affirmé, explication en
// dessous. `title` et `icon` optionnels pour les cas mineurs (filtre sans
// résultat) où un simple message suffit.
export function EmptyView({
  icon,
  title,
  message,
}: {
  icon?: IconName;
  title?: string;
  message: string;
}) {
  const { colors, sharedStyles } = useTheme();
  return (
    <View style={styles.center}>
      {icon ? <Ionicons name={icon} size={40} color={colors.muted} /> : null}
      {title ? <Text style={[sharedStyles.text, styles.title]}>{title}</Text> : null}
      <Text style={[sharedStyles.mutedText, styles.message]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 8,
  },
  pressed: {
    opacity: 0.8,
  },
});
