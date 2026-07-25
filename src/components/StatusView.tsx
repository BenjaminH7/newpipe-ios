import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, sharedStyles } from '@/theme';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={sharedStyles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={[sharedStyles.text, styles.errorText]}>{message}</Text>
      {onRetry ? (
        <Pressable style={sharedStyles.button} onPress={onRetry}>
          <Text style={sharedStyles.buttonText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyView({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={sharedStyles.mutedText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 15,
  },
});
