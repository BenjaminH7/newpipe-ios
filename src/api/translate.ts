// Traduction des paroles en français, via l'endpoint public non-officiel de
// Google Translate (gratuit, sans clé) — même esprit que lyrics.ts/coverArt.ts :
// pas de backend perso, on tape directement une API tierce best-effort.
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const TARGET_LANG = 'fr';
// Nombre de requêtes en vol simultanément : assez pour rester rapide sur une
// piste à ~50 lignes, assez peu pour ne pas se faire rate-limiter.
const CONCURRENCY = 6;
// Taille max de l'échantillon envoyé pour la détection de langue (l'endpoint
// passe le texte en query string, on évite les URL démesurées).
const DETECT_SAMPLE_MAX = 1500;

// Beaucoup de paroles répètent le refrain mot pour mot : un cache par texte
// (et non par piste) évite de re-traduire ces lignes en double.
const cache = new Map<string, string | null>();

interface TranslateResponse {
  0?: Array<[string, string, ...unknown[]]>;
  // Langue source détectée par Google (code ISO, ex. "fr").
  2?: string;
}

async function requestTranslation(
  text: string,
): Promise<{ translated: string | null; sourceLang: string | null }> {
  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: TARGET_LANG, dt: 't', q: text });
    const res = await fetch(`${TRANSLATE_URL}?${params}`);
    if (!res.ok) throw new Error('Échec de la traduction');
    const data = (await res.json()) as TranslateResponse;
    const translated =
      (data[0] ?? []).map((chunk) => chunk[0]).join('').trim() || null;
    return { translated, sourceLang: typeof data[2] === 'string' ? data[2] : null };
  } catch {
    return { translated: null, sourceLang: null };
  }
}

async function translateOne(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (cache.has(trimmed)) return cache.get(trimmed) ?? null;

  const { translated, sourceLang } = await requestTranslation(trimmed);
  // Ligne déjà en français, ou "traduction" identique à l'original : rien à
  // afficher sous la parole.
  const result =
    sourceLang === TARGET_LANG || translated?.toLowerCase() === trimmed.toLowerCase()
      ? null
      : translated;
  cache.set(trimmed, result);
  return result;
}

/**
 * Détecte si un texte est déjà en français, via une seule requête sur un
 * échantillon. En cas d'échec réseau on répond `false` : les traductions
 * ligne à ligne échoueront de la même façon et rendront `null` d'elles-mêmes.
 */
async function isFrench(sample: string): Promise<boolean> {
  const { sourceLang } = await requestTranslation(sample.slice(0, DETECT_SAMPLE_MAX));
  return sourceLang === TARGET_LANG;
}

/**
 * Traduit un bloc de texte (paroles non synchronisées) en une seule requête.
 * Renvoie `null` si le texte est déjà en français.
 */
export async function translateText(text: string): Promise<string | null> {
  return translateOne(text);
}

/**
 * Traduit une liste de lignes de paroles synchronisées. Renvoie un tableau de
 * même longueur que `lines` (valeur `null` si une ligne est vide ou n'a pas pu
 * être traduite), en dédupliquant les lignes identiques (refrains) et en
 * limitant la concurrence réseau. Si la piste est détectée comme déjà en
 * français, aucune traduction n'est faite et le tableau ne contient que des
 * `null`.
 */
export async function translateLines(lines: string[]): Promise<(string | null)[]> {
  const unique = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
  if (unique.length === 0) return lines.map(() => null);

  // Détection globale sur un échantillon plutôt que ligne par ligne : plus
  // fiable sur les lignes courtes ("Oh oh oh"), et ça économise toutes les
  // requêtes quand la piste est déjà en français.
  if (await isFrench(unique.join('\n'))) return lines.map(() => null);

  const results = new Map<string, string | null>();

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const translations = await Promise.all(batch.map(translateOne));
    batch.forEach((line, idx) => results.set(line, translations[idx]));
  }

  return lines.map((line) => results.get(line.trim()) ?? null);
}
