// Port TypeScript de YoutubeJavaScriptExtractor.java + YoutubeSignatureUtils.java
// (NewPipeExtractor) : télécharge le lecteur JS de base de YouTube, en extrait
// la fonction de déobfuscation des signatures de flux, et l'exécute dans la
// WebView (cf. jsEngine.ts) — exactement le même principe que pour BotGuard,
// mais ce code-ci ne dépend d'aucune API navigateur (juste des manipulations
// de tableau), donc pas besoin de BotGuard pour celui-là.
import { embedJson, execute } from './jsEngine';

const FUNCTION_REGEXES: RegExp[] = [
  /\b[a-zA-Z0-9_$]+&&\([a-zA-Z0-9_$]+=([a-zA-Z0-9_$]{2,})\((\d+,)decodeURIComponent\([a-zA-Z0-9_$]+\)\)/,
  /\b[a-zA-Z0-9_$]+&&\([a-zA-Z0-9_$]+=([a-zA-Z0-9_$]{2,})\(decodeURIComponent\([a-zA-Z0-9_$]+\)\)/,
  /\bm=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)/,
  /\bc&&\(c=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(c\)\)/,
  /(?:\b|[^a-zA-Z0-9$])([a-zA-Z0-9$]{2,})\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)/,
  /([\w$]+)\s*=\s*function\((\w+)\)\{\s*\2=\s*\2\.split\(""\)\s*;/,
];

const GLOBAL_ARRAY_REGEX = /var [A-Za-z]=["'].*?["']\.split\("[;{]"\)/;
const HELPER_OBJ_NAME_REGEX = /[;,]([A-Za-z0-9_$]{2,})\[\.\./;
const STS_REGEX = /signatureTimestamp[=:](\d+)/;

/** Extrait le contenu délimité par des accolades équilibrées à partir de l'index de la première `{`. */
function extractBalancedBraces(code: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(openBraceIndex, i + 1);
    }
  }
  throw new Error('Accolade fermante introuvable');
}

function extractFunctionByName(playerCode: string, functionName: string): string {
  const marker = `${functionName}=function`;
  const start = playerCode.indexOf(marker);
  if (start === -1) throw new Error(`Fonction ${functionName} introuvable dans le lecteur JS`);
  const openBrace = playerCode.indexOf('{', start);
  const body = extractBalancedBraces(playerCode, openBrace);
  return `${functionName}=function${playerCode.slice(start + marker.length, openBrace)}${body}`;
}

function extractVarByName(playerCode: string, varName: string): string {
  const marker = `var ${varName}=`;
  const start = playerCode.indexOf(marker);
  if (start === -1) throw new Error(`Variable ${varName} introuvable dans le lecteur JS`);
  const openBrace = playerCode.indexOf('{', start);
  const body = extractBalancedBraces(playerCode, openBrace);
  return `${varName}=${body}`;
}

async function extractPlayerJsUrl(): Promise<string> {
  try {
    const res = await fetch('https://www.youtube.com/iframe_api');
    const text = await res.text();
    const match = text.match(/player\\\/([a-z0-9]{8})\\\//);
    if (match) return `https://www.youtube.com/s/player/${match[1]}/player_ias.vflset/en_GB/base.js`;
  } catch {
    // on retente via la page embed ci-dessous
  }
  const res = await fetch('https://www.youtube.com/embed/dQw4w9WgXcQ');
  const html = await res.text();
  const match = html.match(/"jsUrl":"(\/s\/player\/[A-Za-z0-9]+\/player_ias\.vflset\/[A-Za-z_-]+\/base\.js)"/);
  if (!match) throw new Error("Impossible de trouver l'URL du lecteur JS de YouTube");
  return `https://www.youtube.com${match[1]}`;
}

interface DeobfuscationSetup {
  signatureTimestamp: string | null;
  playerCode: string;
}

let setupPromise: Promise<DeobfuscationSetup> | null = null;

async function setup(): Promise<DeobfuscationSetup> {
  const playerJsUrl = await extractPlayerJsUrl();
  const playerCode = await (await fetch(playerJsUrl)).text();

  const funcMatch = FUNCTION_REGEXES.reduce<RegExpMatchArray | null>(
    (found, regex) => found ?? playerCode.match(regex),
    null
  );
  if (!funcMatch) throw new Error('Fonction de déobfuscation introuvable dans le lecteur JS');
  const functionName = funcMatch[1];
  const additionalParams = funcMatch[2] ?? '';

  const deobfuscationFunction = extractFunctionByName(playerCode, functionName);
  const globalVarDecl = playerCode.match(GLOBAL_ARRAY_REGEX)?.[0];
  if (!globalVarDecl) throw new Error("Tableau global de déobfuscation introuvable");

  const helperObjName = deobfuscationFunction.match(HELPER_OBJ_NAME_REGEX)?.[1];
  if (!helperObjName) throw new Error("Nom de l'objet utilitaire introuvable");
  const helperObjDecl = extractVarByName(playerCode, helperObjName);

  const script = `
    ${globalVarDecl.replace(/^var\s+/, '')};
    ${helperObjDecl};
    ${deobfuscationFunction};
    deobfuscate = function (a) { return ${functionName}(${additionalParams}a); };
    return true;
  `;
  await execute(script);

  const signatureTimestamp = playerCode.match(STS_REGEX)?.[1] ?? null;
  return { signatureTimestamp, playerCode };
}

function ensureSetup(): Promise<DeobfuscationSetup> {
  if (!setupPromise) {
    setupPromise = setup().catch((e) => {
      setupPromise = null;
      throw e;
    });
  }
  return setupPromise;
}

/** Timestamp de signature du lecteur courant, à inclure dans les requêtes `/player`. */
export async function getSignatureTimestamp(): Promise<string | null> {
  const { signatureTimestamp } = await ensureSetup();
  return signatureTimestamp;
}

/** Code source du lecteur JS courant (partagé avec le correctif de throttling pour éviter un second téléchargement). */
export async function getPlayerCode(): Promise<string> {
  const { playerCode } = await ensureSetup();
  return playerCode;
}

/** Déchiffre une signature de flux obfusquée (`signatureCipher`/`cipher`). */
export async function deobfuscateSignature(cipheredSignature: string): Promise<string> {
  await ensureSetup();
  return execute<string>(`return deobfuscate(${embedJson(cipheredSignature)});`);
}
