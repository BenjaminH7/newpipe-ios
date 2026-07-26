// Recherche unique de l'app, ouverte depuis l'onglet Accueil : suggestions
// pendant la frappe, puis résultats filtrés par type (titres, vidéos, albums,
// artistes, playlists) rendus par <MusicSearchResults />. Le filtre « Vidéos »
// interroge la recherche vidéo YouTube, les autres le catalogue YouTube Music.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMusicSearchSuggestions } from '@/api/ytmusic/client';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MusicSearchResults } from '@/components/music/MusicSearchResults';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { clearRecentSearches, forgetSearch, recordSearch } from '@/storage/recentSearches';
import { useTheme, type ColorPalette } from '@/theme';

export default function MusicSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState(q ?? '');
  const [submitted, setSubmitted] = useState(q ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const recentSearches = useRecentSearches();

  // Suggestions au fil de la frappe (debounce court, comme YouTube Music).
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed === submitted) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      getMusicSearchSuggestions(trimmed)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [query, submitted]);

  const submit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(trimmed);
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();
    recordSearch(trimmed);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.searchField}>
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Titres, vidéos, artistes, albums..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={!q}
            onSubmitEditing={() => submit(query)}
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {showSuggestions && suggestions.length > 0 ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
              onPress={() => submit(suggestion)}
            >
              <Ionicons name="search" size={18} color={colors.muted} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {suggestion}
              </Text>
              <Pressable hitSlop={8} onPress={() => setQuery(suggestion)}>
                <Ionicons name="arrow-up-outline" size={18} color={colors.muted} style={styles.fillIcon} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      ) : submitted ? (
        <MusicSearchResults query={submitted} />
      ) : (
        /* Écran de recherche au repos : recherches récentes puis accès à
           Explorer, comme la page Recherche de Spotify qui propose « Parcourir
           tout » plutôt qu'un écran vide. */
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.restingContent}
          showsVerticalScrollIndicator={false}
        >
          {recentSearches.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recherches récentes</Text>
                <Pressable hitSlop={8} onPress={() => clearRecentSearches()}>
                  <Text style={styles.clearAll}>Tout effacer</Text>
                </Pressable>
              </View>
              {recentSearches.map((entry) => (
                <Pressable
                  key={entry.term}
                  style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
                  onPress={() => submit(entry.term)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.muted} />
                  <Text style={styles.recentText} numberOfLines={1}>
                    {entry.term}
                  </Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => forgetSearch(entry.term)}
                    accessibilityLabel={`Retirer ${entry.term} des recherches récentes`}
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          )}

          <Pressable
            onPress={() => router.push('/music/explore')}
            style={({ pressed }) => [styles.browseCard, pressed && styles.pressed]}
          >
            <Ionicons name="compass" size={24} color={colors.text} />
            <View style={styles.browseText}>
              <Text style={styles.browseTitle}>Parcourir tout</Text>
              <Text style={styles.browseSubtitle}>
                Nouveautés, classements, ambiances et genres
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </ScrollView>
      )}

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
    pressed: {
      opacity: 0.6,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      paddingVertical: 11,
    },
    suggestions: {
      flex: 1,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    suggestionText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
    },
    fillIcon: {
      transform: [{ rotate: '-45deg' }],
    },
    restingContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 40,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    clearAll: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
    },
    recentText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
    },
    browseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: 24,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    browseText: {
      flex: 1,
      gap: 3,
    },
    browseTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    browseSubtitle: {
      color: colors.muted,
      fontSize: 13,
    },
  });
}
