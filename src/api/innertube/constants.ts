// SPDX-License-Identifier: GPL-3.0-or-later
// Constantes portées de ClientsConstants.java, Copyright (C) the NewPipe
// Authors (github.com/TeamNewPipe/NewPipeExtractor), licensed
// GPL-3.0-or-later. Comme le reste de youtubeclient, ce fichier est distribué
// sous GNU GPLv3-or-later — voir le fichier LICENSE à la racine.
//
// Constantes InnerTube portées de TeamNewPipe/NewPipeExtractor
// (extractor/.../youtube/ClientsConstants.java), client WEB uniquement : c'est
// le seul pour lequel on sait générer un poToken (via BotGuard, cf. potoken/).

export const YOUTUBEI_V1_URL = 'https://www.youtube.com/youtubei/v1/';
// Endpoint utilisé par les clients non-web (Android, iOS...) — distinct de
// celui du site desktop.
export const YOUTUBEI_V1_GAPIS_URL = 'https://youtubei.googleapis.com/youtubei/v1/';

export const WEB_CLIENT_NAME = 'WEB';
export const WEB_CLIENT_ID = '1';
export const WEB_CLIENT_VERSION = '2.20260120.01.00';

export const ANDROID_CLIENT_NAME = 'ANDROID';
export const ANDROID_CLIENT_VERSION = '21.03.36';
export const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 15; US) gzip`;

export const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// Clé publique utilisée par BotGuard (cf. PoTokenWebView.kt::GOOGLE_API_KEY),
// distincte de la clé InnerTube ci-dessus.
export const BOTGUARD_API_KEY = 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw';
export const BOTGUARD_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

export const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
