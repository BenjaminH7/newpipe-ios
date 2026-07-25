// Bridge générique vers une WebView cachée servant de moteur JavaScript
// "réel" (DOM inclus) : Hermes ne peut pas exécuter le code BotGuard de
// Google (il a besoin d'un vrai environnement navigateur pour être crédible),
// donc on exécute tout — BotGuard, obtainPoToken, déchiffrement de signature,
// paramètre de throttling — dans cette unique page persistante, exactement
// comme NewPipe le fait avec sa PoTokenWebView (mais react-native-webview
// plutôt que le WebView natif Android).
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };

let webviewRef: WebView | null = null;
let readyResolve: (() => void) | null = null;
const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve;
});
const pending = new Map<string, Pending>();
let nextId = 0;

export const BOOTSTRAP_HTML = '<!DOCTYPE html><html><head></head><body></body></html>';

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * `JSON.stringify` ne s'échappe pas U+2028/U+2029 (valides en JSON, mais
 * traités comme des terminateurs de ligne en JavaScript). Sans ce correctif,
 * une valeur les contenant casserait la syntaxe du script injecté. Toujours
 * utiliser ceci (plutôt que `JSON.stringify` nu) pour embarquer une valeur
 * dans un script destiné à `execute()`.
 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).split(LINE_SEPARATOR).join('\\u2028').split(PARAGRAPH_SEPARATOR).join('\\u2029');
}

export function registerWebView(ref: WebView) {
  webviewRef = ref;
}

export function markReady() {
  readyResolve?.();
}

export function handleMessage(event: WebViewMessageEvent) {
  let parsed: { id: string; ok: boolean; result?: any; error?: string };
  try {
    parsed = JSON.parse(event.nativeEvent.data);
  } catch {
    return;
  }
  const entry = pending.get(parsed.id);
  if (!entry) return;
  pending.delete(parsed.id);
  if (parsed.ok) entry.resolve(parsed.result);
  else entry.reject(new Error(parsed.error ?? 'Erreur JavaScript inconnue dans la WebView'));
}

/**
 * Exécute `script` dans la WebView persistante et renvoie sa valeur de retour
 * (sérialisable JSON). `script` peut être asynchrone (renvoyer une Promise) :
 * elle sera attendue avant de répondre. Les variables déclarées sans
 * `var`/`let`/`const` (assignation directe) deviennent globales à la page et
 * persistent donc entre deux appels — c'est ainsi que l'état BotGuard
 * (`webPoSignalOutput`, `integrityToken`) est conservé.
 */
export async function execute<T = any>(script: string, timeoutMs = 15000): Promise<T> {
  await readyPromise;
  if (!webviewRef) throw new Error("Le moteur JavaScript (WebView) n'est pas monté.");

  const id = `req_${nextId++}`;
  const injected = `
    (function () {
      try {
        Promise.resolve((function () { ${script} })()).then(function (result) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${embedJson(id)}, ok: true, result: result === undefined ? null : result }));
        }, function (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${embedJson(id)}, ok: false, error: String((error && error.stack) || error) }));
        });
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${embedJson(id)}, ok: false, error: String((error && error.stack) || error) }));
      }
      true;
    })();
  `;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout d'exécution JavaScript (${timeoutMs}ms) pour la requête ${id}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    webviewRef!.injectJavaScript(injected);
  });
}
