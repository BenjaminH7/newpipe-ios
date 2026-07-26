import { getPlaylistPage, getPlaylistContinuation, searchMusic } from './src/api/ytmusic/client';
async function main() {
const r = await searchMusic('jazz', 'communityPlaylists');
const pl = r.items.find((i) => i.type === 'playlist') as any;
console.log('playlist item:', pl.playlistId, pl.title, '| podcast flag:', pl.podcast);
const page = await getPlaylistPage(pl.playlistId);
console.log('page:', page.title, '| author:', page.author, '| songs:', page.songs.length, '| cont:', !!page.continuation);
console.log('song0:', page.songs[0]?.title, '|', page.songs[0]?.artists.map((a:any)=>a.name).join(', '), '|', page.songs[0]?.duration);
if (page.continuation) {
  const n = await getPlaylistContinuation(page.continuation);
  console.log('page2 songs:', n.songs.length);
}
const s = await searchMusic('daft punk', 'songs');
console.log('songs search:', s.items.length, JSON.stringify(s.items[0]).slice(0, 240));
const a = await searchMusic('daft punk', 'albums');
console.log('albums search:', a.items.length, JSON.stringify(a.items[0]).slice(0, 240));
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
