// Rendu d'une section de page YouTube Music. Deux formes, comme sur
// music.youtube.com et dans Metrolist :
// - une section de titres (« Sélection rapide ») s'affiche en colonnes de
//   rangées qui défilent horizontalement, page par page ;
// - toute autre section s'affiche en carrousel de cartes.
import { useMemo } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MusicSection, YTItem, YTSong } from '@/api/ytmusic/types';
import { useTheme, type ColorPalette } from '@/theme';
import { CARD_WIDTH, ItemCard, itemKey } from './ItemCard';
import { SongRow } from './SongRow';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_WIDTH = SCREEN_WIDTH - 56;
const ROWS_PER_PAGE = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export function SectionHeader({
  title,
  subtitle,
  onMore,
}: {
  title: string;
  subtitle?: string | null;
  onMore?: () => void;
}) {
  const { colors, sharedStyles } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!title && !subtitle) return null;

  return (
    <Pressable
      style={styles.header}
      onPress={onMore}
      disabled={!onMore}
      accessibilityRole={onMore ? 'button' : 'header'}
    >
      <View style={styles.headerText}>
        {subtitle ? <Text style={styles.strapline}>{subtitle}</Text> : null}
        <Text style={sharedStyles.sectionTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {onMore ? <Ionicons name="chevron-forward" size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function SectionCarousel({
  section,
  currentTrackId,
  isPlaying,
  onItemPress,
  onSongPress,
  onSongMenu,
  onMore,
}: {
  section: MusicSection;
  currentTrackId?: string | null;
  isPlaying?: boolean;
  onItemPress: (item: YTItem) => void;
  onSongPress: (song: YTSong, queue: YTSong[]) => void;
  onSongMenu?: (song: YTSong) => void;
  onMore?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const songs = section.items.filter((i): i is YTSong => i.type === 'song');
  // Section 100 % titres : mise en page « sélection rapide » en colonnes.
  const asSongPages = songs.length === section.items.length && songs.length > ROWS_PER_PAGE;

  return (
    <View style={styles.section}>
      <SectionHeader title={section.title} subtitle={section.subtitle} onMore={onMore} />
      {asSongPages ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={PAGE_WIDTH + 12}
          contentContainerStyle={styles.pagesContent}
        >
          {chunk(songs, ROWS_PER_PAGE).map((page, pageIndex) => (
            <View key={pageIndex} style={[styles.page, { width: PAGE_WIDTH }]}>
              {page.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  isActive={song.id === currentTrackId}
                  isPlaying={isPlaying}
                  onPress={() => onSongPress(song, songs)}
                  onMenu={onSongMenu ? () => onSongMenu(song) : undefined}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContent}
        >
          {section.items.map((item, index) => (
            <ItemCard
              key={`${itemKey(item)}-${index}`}
              item={item}
              width={CARD_WIDTH}
              onPress={() =>
                item.type === 'song' ? onSongPress(item, songs) : onItemPress(item)
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    section: {
      marginBottom: 26,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    strapline: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    cardsContent: {
      paddingHorizontal: 20,
      gap: 14,
    },
    pagesContent: {
      paddingHorizontal: 20,
      gap: 12,
    },
    page: {
      gap: 2,
    },
  });
}
