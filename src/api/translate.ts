// Traduction des paroles en français, via l'endpoint public non-officiel de
// Google Translate (gratuit, sans clé) — même esprit que lyrics.ts/coverArt.ts :
// pas de backend perso, on tape directement une API tierce best-effort.
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const TARGET_LANG = 'fr';
// Nombre de requêtes en vol simultanément : assez pour rester rapide sur une
// piste à ~50 lignes, assez peu pour ne pas se faire rate-limiter.
const CONCURRENCY = 6;

// Beaucoup de paroles répètent le refrain mot pour mot : un cache par texte
// (et non par piste) évite de re-traduire ces lignes en double.
const cache = new Map<string, string | null>();

interface TranslateResponse {
  0?: Array<[string, string, ...unknown[]]>;
}

async function translateOne(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (cache.has(trimmed)) return cache.get(trimmed) ?? null;

  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: TARGET_LANG, dt: 't', q: trimmed });
    const res = await fetch(`${TRANSLATE_URL}?${params}`);
    if (!res.ok) throw new Error('Échec de la traduction');
    const data = (await res.json()) as TranslateResponse;
    const translated =
      (data[0] ?? []).map((chunk) => chunk[0]).join('').trim() || null;
    cache.set(trimmed, translated);
    return translated;
  } catch {
    cache.set(trimmed, null);
    return null;
  }
}

/**
 * Traduit un bloc de texte (paroles non synchronisées) en une seule requête.
 */
export async function translateText(text: string): Promise<string | null> {
  return translateOne(text);
}

/**
 * Traduit une liste de lignes de paroles synchronisées. Renvoie un tableau de
 * même longueur que `lines` (valeur `null` si une ligne est vide ou n'a pas pu
 * être traduite), en dédupliquant les lignes identiques (refrains) et en
 * limitant la concurrence réseau.
 */
export async function translateLines(lines: string[]): Promise<(string | null)[]> {
  const unique = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
  const results = new Map<string, string | null>();

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const translations = await Promise.all(batch.map(translateOne));
    batch.forEach((line, idx) => results.set(line, translations[idx]));
  }

  return lines.map((line) => results.get(line.trim()) ?? null);
}
