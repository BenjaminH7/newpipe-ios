// Port TypeScript de PoTokenWebView.kt + PoTokenProviderImpl.kt (NewPipe) :
// obtient un poToken (jeton d'attestation "BotGuard") pour le client WEB, en
// exécutant le vrai challenge de Google dans la WebView (voir jsEngine.ts).
import {
  BOTGUARD_API_KEY,
  BOTGUARD_REQUEST_KEY,
  DESKTOP_USER_AGENT,
  INNERTUBE_API_KEY,
  WEB_CLIENT_VERSION,
  YOUTUBEI_V1_URL,
} from '../constants';
import { embedJson, execute } from '../jsEngine';
import { BOTGUARD_BOOTSTRAP_SCRIPT } from './botguardScript';
import { parseChallengeData, parseIntegrityTokenData, poTokenBytesToString, stringToU8Literal } from './parse';

export interface PoTokenResult {
  visitorData: string;
  playerRequestPoToken: string;
  streamingDataPoToken: string;
}

let bootstrapped = false;
async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  await execute(BOTGUARD_BOOTSTRAP_SCRIPT);
  bootstrapped = true;
}

async function botguardRequest(endpoint: string, body: unknown): Promise<string> {
  const res = await fetch(`https://www.youtube.com/api/jnn/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'User-Agent': DESKTOP_USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json+protobuf',
      'x-goog-api-key': BOTGUARD_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`BotGuard ${endpoint} a répondu ${res.status}`);
  return res.text();
}

async function fetchVisitorData(): Promise<string> {
  const res = await fetch(`${YOUTUBEI_V1_URL}visitor_id?key=${INNERTUBE_API_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: {
        client: { clientName: 'WEB', clientVersion: WEB_CLIENT_VERSION, hl: 'en', gl: 'US', utcOffsetMinutes: 0 },
      },
    }),
  });
  const data = await res.json();
  const visitorData = data?.responseContext?.visitorData;
  if (!visitorData) throw new Error('Impossible de récupérer visitorData depuis InnerTube.');
  return visitorData;
}

async function runBotguardAndGetIntegrityToken(): Promise<number> {
  await ensureBootstrapped();

  const createResponse = await botguardRequest('Create', [BOTGUARD_REQUEST_KEY]);
  const challengeData = parseChallengeData(createResponse);

  const botguardResponse = await execute<string>(`
    webPoSignalOutput = [];
    return runBotGuard(${embedJson(challengeData)}).then(function (result) {
      webPoSignalOutput = result.webPoSignalOutput;
      return result.botguardResponse;
    });
  `);

  const generateItResponse = await botguardRequest('GenerateIT', [BOTGUARD_REQUEST_KEY, botguardResponse]);
  const { integrityTokenBytes, expiresInSeconds } = parseIntegrityTokenData(generateItResponse);

  await execute(`integrityToken = new Uint8Array(${embedJson(integrityTokenBytes)}); return true;`);
  return expiresInSeconds;
}

async function mintPoToken(identifier: string): Promise<string> {
  const bytes = await execute<number[]>(`
    var u8Identifier = new Uint8Array(${embedJson(stringToU8Literal(identifier))});
    var poTokenU8 = obtainPoToken(webPoSignalOutput, integrityToken, u8Identifier);
    return Array.from(poTokenU8);
  `);
  return poTokenBytesToString(bytes);
}

interface Session {
  visitorData: string;
  streamingDataPoToken: string;
  expiresAt: number;
}

let session: Session | null = null;
let sessionPromise: Promise<Session> | null = null;

async function createSession(): Promise<Session> {
  const visitorData = await fetchVisitorData();
  const expiresInSeconds = await runBotguardAndGetIntegrityToken();
  // Le poToken de streaming doit être généré une seule fois, en premier,
  // avant tout autre poToken (contrainte documentée par NewPipe).
  const streamingDataPoToken = await mintPoToken(visitorData);
  // Marge de sécurité de 10 minutes, comme NewPipe.
  return { visitorData, streamingDataPoToken, expiresAt: Date.now() + (expiresInSeconds - 600) * 1000 };
}

function getSession(): Promise<Session> {
  if (session && Date.now() < session.expiresAt) return Promise.resolve(session);
  if (!sessionPromise) {
    sessionPromise = createSession()
      .then((s) => {
        session = s;
        return s;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

/** Obtient un jeu de poTokens (lecture + streaming) pour `videoId`, en initialisant BotGuard si besoin. */
export async function getPoTokenResult(videoId: string): Promise<PoTokenResult> {
  const s = await getSession();
  const playerRequestPoToken = await mintPoToken(videoId);
  return { visitorData: s.visitorData, playerRequestPoToken, streamingDataPoToken: s.streamingDataPoToken };
}
