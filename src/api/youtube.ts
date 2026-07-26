// Point d'entrée public de l'API vidéo de l'app : parle directement à
// l'infrastructure InnerTube de YouTube (recherche, métadonnées, lecture),
// sans dépendre d'un proxy tiers. Voir src/api/innertube/ pour le détail.
export type { VideoSummary, VideoInfo, SearchResult, PlayableSource } from './innertube/client';
export {
  searchVideos,
  searchVideosNextPage,
  getVideoInfo,
  getChannelUploads,
  getChannelUploadsNextPage,
  getRadioQueue,
} from './innertube/client';
