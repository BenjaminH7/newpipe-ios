import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { cancelRecognition, recognizeOnce, shazamAvailable } from '@/api/shazamKit';
import { MiniPlayer } from '@/components/MiniPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShazamHistoryItem } from '@/components/ShazamHistoryItem';
import { useBottomOffsets } from '@/hooks/useBottomOffsets';
import { useClearShazamHistory, useRemoveShazamEntry, useShazamHistory } from '@/hooks/useShazamHistory';
import { recordShazamMatch, type ShazamHistoryEntry } from '@/storage/shazamHistory';
import { useTheme, type ColorPalette } from '@/theme';

type Status = 'idle' | 'listening' | 'match' | 'no-match' | 'error';

const STATUS_MESSAGES: Partial<Record<Status, string>> = {
  idle: 'Appuie pour reconnaître la musique qui joue autour de toi.',
  listening: 'Écoute en cours… Appuie pour annuler.',
  'no-match': 'Aucun titre reconnu. Rapproche-toi de la source et réessaie.',
  match: 'Titre reconnu et ajouté à l’historique.',
};

const UNAVAILABLE_MESSAGE =
  Platform.OS === 'ios'
    ? "La reconnaissance nécessite un build natif avec expo-shazamkit : elle est indisponible dans Expo Go. Lance l'app via expo run:ios ou un build EAS."
    : 'La reconnaissance Shazam est disponible uniquement sur iOS.';

export default function ShazamScreen() {
  const router = useRouter();
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentBottomPadding } = useBottomOffsets();
  const entries = useShazamHistory();
  const removeEntry = useRemoveShazamEntry();
  const clearAll = useClearShazamHistory();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastMatch, setLastMatch] = useState<ShazamHistoryEntry | null>(null);
  // Compteur d'invalidation : la promesse native ne se règle jamais après un
  // stopListening (annulation, changement d'onglet), donc chaque écoute reçoit
  // un id et seul le résultat de l'écoute encore courante est pris en compte.
  const requestId = useRef(0);

  const listening = status === 'listening';

  // Anneau qui s'étend + bouton qui "respire" pendant l'écoute.
  const ring = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) return;
    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    ringLoop.start();
    breathLoop.start();
    return () => {
      ringLoop.stop();
      breathLoop.stop();
      ring.setValue(0);
      breath.setValue(0);
    };
  }, [listening, ring, breath]);

  const cancelListening = useCallback(() => {
    requestId.current += 1;
    cancelRecognition();
    setStatus((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  // Quitter l'onglet coupe l'écoute (et le micro) plutôt que de laisser
  // tourner l'audio engine en arrière-plan.
  useFocusEffect(useCallback(() => cancelListening, [cancelListening]));

  const listen = useCallback(async () => {
    const id = ++requestId.current;
    setStatus('listening');
    setError(null);
    try {
      const result = await recognizeOnce();
      if (requestId.current !== id) return;
      if (result.status === 'match') {
        const entry = await recordShazamMatch(result.item);
        if (requestId.current !== id) return;
        setLastMatch(entry);
        setStatus('match');
      } else {
        setLastMatch(null);
        setStatus('no-match');
      }
    } catch (e) {
      if (requestId.current !== id) return;
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }, []);

  const onPressButton = () => {
    if (!shazamAvailable) return;
    if (listening) {
      cancelListening();
    } else {
      void listen();
    }
  };

  // Cœur de l'intégration : un titre reconnu se cherche dans l'app (onglet
  // Rechercher), pour retrouver le clip / la version YouTube directement.
  const searchInApp = useCallback(
    (entry: ShazamHistoryEntry) => {
      // Le nonce force le re-déclenchement côté Rechercher même quand on
      // relance la même requête (le param q seul serait inchangé).
      router.push({
        pathname: '/',
        params: { q: `${entry.artist} ${entry.title}`, qNonce: String(Date.now()) },
      });
    },
    [router],
  );

  const confirmClearAll = () => {
    Alert.alert("Effacer tout l'historique Shazam ?", 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: clearAll },
    ]);
  };

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.4, 0] });
  const buttonScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const statusMessage = !shazamAvailable
    ? UNAVAILABLE_MESSAGE
    : status === 'error'
      ? (error ?? 'Une erreur est survenue.')
      : STATUS_MESSAGES[status];

  const header = (
    <View>
      <View style={styles.listenZone}>
        <View style={styles.buttonWrap}>
          <Animated.View
            style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            pointerEvents="none"
          />
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              onPress={onPressButton}
              disabled={!shazamAvailable}
              accessibilityLabel={listening ? "Annuler l'écoute" : "Lancer la reconnaissance"}
              style={({ pressed }) => [
                styles.listenButton,
                !shazamAvailable && styles.listenButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="mic" size={64} color={colors.accentText} />
            </Pressable>
          </Animated.View>
        </View>
        <Text style={[sharedStyles.mutedText, styles.statusText]}>{statusMessage}</Text>
      </View>

      {lastMatch ? (
        <Pressable
          onPress={() => searchInApp(lastMatch)}
          style={({ pressed }) => [sharedStyles.card, styles.matchCard, pressed && styles.pressed]}
        >
          {lastMatch.artworkUrl ? (
            <Image
              source={{ uri: lastMatch.artworkUrl }}
              style={[styles.matchArtwork, sharedStyles.coverSmall]}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.matchArtwork, sharedStyles.coverSmall, styles.matchArtworkFallback]}>
              <Ionicons name="musical-note" size={26} color={colors.muted} />
            </View>
          )}
          <View style={styles.matchInfo}>
            <Text style={[sharedStyles.text, styles.matchTitle]} numberOfLines={1}>
              {lastMatch.title}
            </Text>
            <Text style={sharedStyles.mutedText} numberOfLines={1}>
              {lastMatch.artist}
            </Text>
            <Text style={[sharedStyles.mutedText, styles.matchHint]} numberOfLines={1}>
              Appuie pour chercher dans l’app
            </Text>
          </View>
          {lastMatch.appleMusicUrl ? (
            <Pressable
              hitSlop={8}
              accessibilityLabel="Ouvrir dans Apple Music"
              onPress={() => Linking.openURL(lastMatch.appleMusicUrl!)}
              style={({ pressed }) => [styles.appleMusicButton, pressed && styles.pressed]}
            >
              <Ionicons name="logo-apple" size={22} color={colors.text} />
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {entries.length > 0 ? (
        <View style={styles.historyHeader}>
          <Text style={sharedStyles.sectionTitle}>Historique</Text>
          <Pressable onPress={confirmClearAll} hitSlop={8}>
            <Text style={styles.clearButtonText}>Tout effacer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Shazam"
        subtitle={
          entries.length > 0
            ? `${entries.length} titre${entries.length > 1 ? 's' : ''} reconnu${entries.length > 1 ? 's' : ''}`
            : undefined
        }
      />

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <ShazamHistoryItem
            entry={item}
            onPress={() => searchInApp(item)}
            onRemove={() => removeEntry(item.id)}
          />
        )}
      />

      <MiniPlayer />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    listenZone: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 20,
      gap: 20,
    },
    buttonWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulseRing: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.accent,
    },
    listenButton: {
      width: 150,
      height: 150,
      borderRadius: 75,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    listenButtonDisabled: {
      backgroundColor: colors.border,
    },
    pressed: {
      opacity: 0.8,
    },
    statusText: {
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 19,
    },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      marginBottom: 20,
    },
    matchArtwork: {
      width: 56,
      height: 56,
    },
    matchArtworkFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    matchInfo: {
      flex: 1,
      gap: 2,
    },
    matchTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    matchHint: {
      fontSize: 12,
    },
    appleMusicButton: {
      padding: 6,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    clearButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
