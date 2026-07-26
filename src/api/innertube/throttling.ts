// SPDX-License-Identifier: GPL-3.0-or-later
// Port TypeScript de YoutubeThrottlingParameterUtils.java, Copyright (C) the
// NewPipe Authors (github.com/TeamNewPipe/NewPipeExtractor), licensed
// GPL-3.0-or-later. Comme le reste de youtubeclient, ce fichier est distribué
// sous GNU GPLv3-or-later — voir le fichier LICENSE à la racine.
//
// (NewPipeExtractor) :
// les flux DASH/adaptatifs de YouTube portent parfois un paramètre `n` qui,
// s'il n'est pas "déchiffré", fait volontairement brider (throttle) le débit
// de téléchargement par le CDN. Ce n'est pas bloquant pour la lecture (juste
// plus lent), donc on applique cette correction en best-effort : si
// l'extraction échoue, on renvoie l'URL telle quelle plutôt que de faire
// planter la lecture.
import { getPlayerCode } from './cipher';
import { embedJson, execute } from './jsEngine';

const SINGLE = '[a-zA-Z0-9$_]';
const MULTI = `${SINGLE}+`;
const ARRAY_ACCESS = '\\[(\\d+)\\]';

const NAME_REGEXES: RegExp[] = [
  /([A-Za-z0-9_$]{2,})=function.*return [A-Z]\[\d+\]/,
  new RegExp(
    `${SINGLE}="nn"\\[\\+${MULTI}\\.${MULTI}\\],${MULTI}\\(${MULTI}\\),${MULTI}=${MULTI}\\.${MULTI}\\[${MULTI}\\]\\|\\|null\\)&&\\(${MULTI}=(${MULTI})${ARRAY_ACCESS}`
  ),
  new RegExp(
    `${SINGLE}="nn"\\[\\+${MULTI}\\.${MULTI}\\],${MULTI}\\(${MULTI}\\),${MULTI}=${MULTI}\\.${MULTI}\\[${MULTI}\\]\\|\\|null\\).+\\|\\|(${MULTI})\\(""\\)`
  ),
  new RegExp(
    `,${MULTI}\\(${MULTI}\\),${MULTI}=${MULTI}\\.${MULTI}\\[${MULTI}\\]\\|\\|null\\)&&\\(\\b${MULTI}=(${MULTI})${ARRAY_ACCESS}\\(${SINGLE}\\),${MULTI}\\.set\\((?:"n+"|${MULTI}),${MULTI}\\)`
  ),
  new RegExp(
    `${SINGLE}="nn"\\[\\+${MULTI}\\.${MULTI}\\],${MULTI}=${MULTI}\\.get\\(${MULTI}\\)\\).+\\|\\|(${MULTI})\\(""\\)`
  ),
  new RegExp(
    `${SINGLE}="nn"\\[\\+${MULTI}\\.${MULTI}\\],${MULTI}=${MULTI}\\.get\\(${MULTI}\\)\\)&&\\(${MULTI}=(${MULTI})\\[(\\d+)\\]`
  ),
  new RegExp(
    `\\(${SINGLE}=String\\.fromCharCode\\(110\\),${SINGLE}=${SINGLE}\\.get\\(${SINGLE}\\)\\)&&\\(${SINGLE}=(${MULTI})(?:${ARRAY_ACCESS})?\\(${SINGLE}\\)`
  ),
  new RegExp(`\\.get\\("n"\\)\\)&&\\(${SINGLE}=(${MULTI})(?:${ARRAY_ACCESS})?\\(${SINGLE}\\)`),
];

function extractBalancedBraces(code: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(openBraceIndex, i + 1);
    }
  }
  throw new Error('Accolade fermante introuvable (throttling)');
}

function findFunctionName(playerCode: string): { name: string; arrayIndex: number | null } {
  for (const regex of NAME_REGEXES) {
    const m = playerCode.match(regex);
    if (!m) continue;
    if (m.length <= 2) return { name: m[1], arrayIndex: null };
    return { name: m[1], arrayIndex: Number(m[2]) };
  }
  throw new Error('Fonction de throttling introuvable dans le lecteur JS');
}

function resolveArrayIndirection(playerCode: string, arrayName: string, index: number): string {
  const arrayRegex = new RegExp(`var\\s+${arrayName}\\s*=\\s*\\[(.+?)\\][;,]`);
  const m = playerCode.match(arrayRegex);
  if (!m) throw new Error(`Tableau ${arrayName} introuvable`);
  const names = m[1].split(',').map((s) => s.trim());
  return names[index];
}

function extractFunctionCode(playerCode: string, functionName: string): string {
  const marker = `${functionName}=function`;
  const start = playerCode.indexOf(marker);
  if (start === -1) throw new Error(`Fonction ${functionName} introuvable`);
  const openBrace = playerCode.indexOf('{', start);
  const body = extractBalancedBraces(playerCode, openBrace);
  return `${functionName}=function${playerCode.slice(start + marker.length, openBrace)}${body}`;
}

/** Retire le early-return `if(typeof X==="undefined")return a;` qui casse la fonction hors contexte du lecteur. */
function fixupFunction(func: string): string {
  const argsMatch = func.match(/=\s*function\s*\(\s*([^)]*)\s*\)/);
  const firstArg = argsMatch?.[1]?.split(',')[0]?.trim();
  if (!firstArg) return func;
  const earlyReturn = new RegExp(`;\\s*if\\s*\\(\\s*typeof\\s+${MULTI}\\s*===?\\s*(["'])undefined\\1\\s*\\)\\s*return\\s+${firstArg};`);
  return func.replace(earlyReturn, ';');
}

let setupPromise: Promise<void> | null = null;

async function setup(): Promise<void> {
  const playerCode = await getPlayerCode();
  const { name, arrayIndex } = findFunctionName(playerCode);
  const functionName = arrayIndex === null ? name : resolveArrayIndirection(playerCode, name, arrayIndex);
  const func = fixupFunction(extractFunctionCode(playerCode, functionName));
  await execute(`
    ${func};
    fixThrottling = function (n) { return ${functionName}(n); };
    return true;
  `);
}

function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = setup().catch((e) => {
      setupPromise = null;
      throw e;
    });
  }
  return setupPromise;
}

/** Répare le paramètre `n` d'une URL de flux si présent ; renvoie l'URL inchangée en cas d'échec (best-effort). */
export async function fixThrottlingInUrl(url: string): Promise<string> {
  const match = url.match(/[&?]n=([^&]+)/);
  if (!match) return url;
  try {
    await ensureSetup();
    const fixed = await execute<string>(`return fixThrottling(${embedJson(match[1])});`);
    return url.replace(`n=${match[1]}`, `n=${encodeURIComponent(fixed)}`);
  } catch {
    return url;
  }
}
