# youtubeclient — a NewPipe-style YouTube client, but for iOS

This project is a rewrite, in TypeScript/React Native (Expo), of the
extraction and playback techniques used by
[NewPipe](https://github.com/TeamNewPipe/NewPipe) and its library
[NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor), adapted
to a context where there is no JVM, no native Android WebView, and no Google
Play app: an iPhone, running inside **Expo Go**.

NewPipe is an Android app (GPLv3, distributed on F-Droid) that acts as an
alternative frontend to YouTube (among other services): search, playback,
downloads, no account, no official API, no ads, by talking directly to
YouTube's internal API (InnerTube) instead of the public one. The project has
never had an iOS version — Apple has no equivalent of F-Droid, and the app
relies on Android-specific APIs (ExoPlayer, Android WebView, Room/SQLite) that
have no direct iOS counterpart. `youtubeclient` starts from scratch to reach
an equivalent result (search + ad-free playback) by relying on the same ideas
as NewPipe/NewPipeExtractor, reimplemented with the building blocks available
on React Native/iOS.

## What was ported, and how

### 1. The InnerTube client (`src/api/innertube/client.ts`)

Three combined strategies, as in NewPipeExtractor:

- **Search and metadata** via the `WEB` client (youtube.com's own
  infrastructure — the most reliable one).
- **Guaranteed playback** via the `ANDROID` "Reel" trick
  (`reel_item_watch`), lifted straight from NewPipe: it requires no poToken
  and returns a muxed stream (audio+video in a single file), capped at 360p —
  the only muxed format YouTube still provides.
- **Best-effort HD** via the `WEB` client + poToken (BotGuard) + deciphered
  adaptive DASH streams, with automatic fallback to guaranteed playback on
  failure (YouTube regularly blacklists one method or another).

### 2. The hidden JS engine — the most important adaptation (`jsEngine.ts` / `JsEngineView.tsx`)

Generating a poToken requires running Google's BotGuard challenge, which
checks that it's running inside a real browser (DOM, fingerprinting). React
Native's JS engine (Hermes) has no DOM and can't fake one. NewPipe solves this
on Android with a hidden Android `WebView` (`PoTokenWebView.kt`). This project
ports the exact same idea: a single invisible `WebView`
(`react-native-webview`, which wraps `WKWebView` on iOS), mounted once at the
app's root (`app/_layout.tsx`), with `baseUrl: https://www.youtube.com` so
BotGuard sees the right origin.

Everything that depends on this "real" JS environment (BotGuard, signature
deciphering, throttling fix) is dispatched to that WebView through a small
homemade RPC bridge (`execute()` in `jsEngine.ts`): the script is injected,
its result comes back via `postMessage`. The page's global variables
(`webPoSignalOutput`, `integrityToken`, the signature decipherer) persist
across calls, exactly like on NewPipe's single page.

### 3. BotGuard / poToken (`potoken/`)

- `botguardScript.ts`: a near-verbatim port of `po_token.html` (the NewPipe
  app asset that loads Google's BotGuard VM).
- `poToken.ts`: a port of `PoTokenWebView.kt` + `PoTokenProviderImpl.kt`
  (session creation, `visitorData`, minting the streaming poToken first, then
  per-video poTokens, 10-minute safety margin before expiry).
- `parse.ts`: a port of `JavaScriptUtil.kt` (decoding the raw responses from
  the `Create`/`GenerateIT` endpoints).

### 4. Signature deciphering and throttling (`cipher.ts`, `throttling.ts`)

Direct ports of `YoutubeJavaScriptExtractor.java` /
`YoutubeSignatureUtils.java` and `YoutubeThrottlingParameterUtils.java`
(NewPipeExtractor): downloading YouTube's player JS, regex-extracting the
deobfuscation/anti-throttling function, running it inside the same hidden
WebView. Throttling is fixed best-effort: a failure returns the URL unchanged
rather than breaking playback.

### 5. Stream selection (`streamSelection.ts`)

Follows the spirit of `buildAndAddItagInfoToList`: picks the best
video-only/audio-only pair among the adaptive DASH formats, preferring
H.264/AAC (hardware-decodable on every iPhone) over VP9/AV1/Opus.

### 6. Playback with two synchronized streams (`PlayableVideoView.tsx`)

Unlike ExoPlayer on Android, `expo-video` (backed by `AVPlayer` on iOS) can't
natively mux two separate DASH streams. So this component drives **two
players**: the video-only stream is authoritative (playback state, lock-screen
now-playing info), and the audio-only stream is resynced against it on every
`timeUpdate` (0.25s tolerance). The same tick also handles auto-skipping
SponsorBlock segments.

### 7. SponsorBlock, narrowed down to product placement (`sponsorblock.ts`)

Unlike NewPipe, which exposes every SponsorBlock category, this app only
targets `sponsor` + `selfpromo` ("product placement"), with a single toggle to
enable/disable the automatic skip.

### 8. Local storage (`src/storage/`)

No Room/SQLite: three small pub/sub caches on top of `AsyncStorage` (a
"watch later" list, watch progress with automatic resume, settings).
Deliberately simpler than NewPipe's database.

## What wasn't carried over from NewPipe

Unlike the full NewPipe, this app is limited to YouTube (no
PeerTube/SoundCloud/Bandcamp/media.ccc.de), has no subscriptions, no
downloads, no history, and a single local playlist instead of several.

## Tech stack

Expo Router (TypeScript), screens: search (`app/(tabs)/index.tsx`), "watch
later" playlist (`app/(tabs)/playlists.tsx`), detail/playback
(`app/video/[id].tsx`). Pinned to **Expo SDK 54** (see [AGENTS.md](AGENTS.md))
to stay compatible with the public Expo Go app — required to test on a
physical iPhone without a custom dev client.

```bash
npm install
npx expo start        # then scan the QR code with the Expo Go app (iOS)
npx expo start --ios  # or launch directly in an iOS simulator
```

A physical device (or a simulator with network access) is recommended: the
hidden WebView and video playback behave differently in the simulator.

## Caveats

- **Best-effort by nature**: everything relies on undocumented internal
  YouTube APIs (InnerTube, BotGuard, obfuscated player JS). YouTube can break
  any method overnight; that's why playback has a three-tier fallback instead
  of a single path.
- **Not affiliated** with Google/YouTube or TeamNewPipe. Personal and
  educational use.

## License

This project is licensed under the **GNU General Public License v3.0 or
later** (see [LICENSE](LICENSE)), not the MIT license the Expo template
starts you with. It was relicensed because a good part of the logic under
`src/api/innertube/` is a direct port of NewPipe/NewPipeExtractor code
(Copyright (C) the NewPipe Authors, GPLv3), and the GPL requires any work
that incorporates GPL-licensed code to be distributed as a whole under
GPL-compatible terms. The affected files carry an `SPDX-License-Identifier`
header pointing at the specific upstream NewPipe/NewPipeExtractor source they
port.

One practical consequence: the FSF and Apple's own App Store Terms are
considered mutually incompatible (the Store imposes usage/DRM restrictions
that GPLv3 §7 forbids adding on top of the license) — this is the same
conflict that forced VLC off the App Store in 2011 until its iOS build was
relicensed under MPL. In its current, correctly-licensed GPLv3 form, this
project cannot legally be distributed through the Apple App Store or Google
Play; that would require either a license grant from TeamNewPipe or a
clean-room rewrite of the ported portions under a non-copyleft license.
