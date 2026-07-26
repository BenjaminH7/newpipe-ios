// Passerelle de données entre l'app et l'extension widget.
//
// Le widget tourne dans un processus séparé : il ne voit ni l'AsyncStorage de
// l'app, ni son système de fichiers. Le seul canal est l'App Group. Le lecteur
// JS y écrit un petit JSON (via modules/widget-data) et y dépose les pochettes
// en fichiers ; ce fichier ne fait que relire tout ça.
import SwiftUI
import WidgetKit

let appGroupIdentifier = "group.com.erwinsicot.youtubeclient"
private let payloadKey = "widgetPayload"

struct WidgetTrack: Codable, Identifiable, Hashable {
  let id: String
  let title: String
  let artist: String
  /// Nom de fichier dans <container>/artwork, ou `nil` si la pochette n'a pas
  /// pu être téléchargée.
  let artworkFile: String?
}

struct WidgetPayload: Codable {
  let nowPlaying: WidgetTrack?
  let isPlaying: Bool
  let recent: [WidgetTrack]

  static let empty = WidgetPayload(nowPlaying: nil, isPlaying: false, recent: [])
}

enum SharedStore {
  static func read() -> WidgetPayload {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let raw = defaults.string(forKey: payloadKey),
      let data = raw.data(using: .utf8),
      let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
    else {
      return .empty
    }
    return payload
  }

  static func artwork(for track: WidgetTrack?) -> UIImage? {
    guard
      let file = track?.artworkFile,
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupIdentifier
      )
    else {
      return nil
    }
    let url = container.appendingPathComponent("artwork").appendingPathComponent(file)
    return UIImage(contentsOfFile: url.path)
  }
}

// MARK: - Éléments d'interface partagés

/// Pochette carrée à coins arrondis, avec un repli discret quand l'image
/// manque (téléchargement échoué, ou aucune écoute encore enregistrée).
struct Cover: View {
  let track: WidgetTrack?
  var corner: CGFloat = 8

  var body: some View {
    ZStack {
      if let image = SharedStore.artwork(for: track) {
        Image(uiImage: image)
          .resizable()
          .aspectRatio(contentMode: .fill)
      } else {
        Rectangle()
          .fill(.quaternary)
        Image(systemName: "music.note")
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(.secondary)
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
  }
}

extension View {
  /// `containerBackground` est obligatoire depuis iOS 17, sous peine de widget
  /// blanc sur l'écran d'accueil.
  func widgetSurface() -> some View {
    containerBackground(for: .widget) {
      Color("$widgetBackground")
    }
  }
}

/// URL de deep link : l'app enregistre le scheme `youtubeclient`.
func playURL(_ track: WidgetTrack) -> URL? {
  URL(string: "youtubeclient://play/\(track.id)")
}

let playerURL = URL(string: "youtubeclient://music/player")
