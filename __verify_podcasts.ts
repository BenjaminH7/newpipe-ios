// Vérifie la chaîne réelle : recherche podcasts/épisodes -> page émission -> pagination.
import {
  getPlaylistContinuation,
  getPlaylistPage,
  searchMusic,
  searchMusicContinuation,
} from './src/api/ytmusic/client';

async function main() {
  const shows = await searchMusic('lex fridman', 'podcasts');
  console.log('PODCASTS:', shows.items.length, 'continuation:', !!shows.continuation);
  console.log(JSON.stringify(shows.items.slice(0, 3), null, 1));

  const eps = await searchMusic('lex fridman', 'episodes');
  console.log('\nEPISODES:', eps.items.length, 'continuation:', !!eps.continuation);
  console.log(JSON.stringify(eps.items.slice(0, 3), null, 1));

  if (eps.continuation) {
    const more = await searchMusicContinuation(eps.continuation);
    console.log('episodes page 2:', more.items.length, 'first:', more.items[0] && (more.items[0] as any).title);
  }

  const show = shows.items.find((i) => i.type === 'playlist') as any;
  console.log('\nOPEN SHOW:', show.playlistId);
  const page = await getPlaylistPage(show.playlistId);
  console.log('title:', page.title, '| author:', page.author, '| thumb:', !!page.thumbnail);
  console.log('subtitle:', (page.subtitle ?? '').slice(0, 80));
  console.log('songs:', page.songs.length, 'continuation:', !!page.continuation);
  console.log(JSON.stringify(page.songs.slice(0, 3), null, 1));

  if (page.continuation) {
    const next = await getPlaylistContinuation(page.continuation);
    console.log('\nepisodes page 2:', next.songs.length, '| next continuation:', !!next.continuation);
    console.log('first:', next.songs[0]?.title, '|', next.songs[0]?.duration);
  }

  // Non-régression : une playlist musicale ordinaire.
  const pl = await getPlaylistPage('RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFC6TdBg');
  console.log('\nPLAYLIST MUSICALE:', pl.title, '| songs:', pl.songs.length, '| author:', pl.author);
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
