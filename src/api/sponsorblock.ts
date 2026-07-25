// Intégration SponsorBlock (sponsor.ajay.app) : base communautaire de segments
// horodatés par vidéo. YouTube n'expose aucune donnée de ce type via InnerTube,
// c'est donc la seule façon (utilisée aussi par NewPipe et consorts) de savoir
// où se trouvent les placements de produits pour les passer automatiquement.
const SPONSORBLOCK_API_URL = 'https://sponsor.ajay.app/api/skipSegments';

// "sponsor" : promotion payante (le placement de produit classique).
// "selfpromo" : autopromotion non payée (merch, produit maison...).
// Les deux catégories couvrent ce qu'on entend par "placement de produit".
const PRODUCT_PLACEMENT_CATEGORIES = ['sponsor', 'selfpromo'];

export interface ProductPlacementSegment {
  startTime: number;
  endTime: number;
}

export async function getProductPlacementSegments(videoId: string): Promise<ProductPlacementSegment[]> {
  try {
    const url = `${SPONSORBLOCK_API_URL}?videoID=${encodeURIComponent(videoId)}&categories=${encodeURIComponent(
      JSON.stringify(PRODUCT_PLACEMENT_CATEGORIES)
    )}`;
    const res = await fetch(url);
    if (res.status === 404) return []; // aucun segment connu pour cette vidéo
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{ segment: [number, number] }>;
    return data
      .map(({ segment }) => ({ startTime: segment[0], endTime: segment[1] }))
      .sort((a, b) => a.startTime - b.startTime);
  } catch {
    return []; // best-effort : ne doit jamais bloquer la lecture
  }
}
