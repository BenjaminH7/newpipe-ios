// Alimente l'extension widget (targets/widget) depuis le lecteur JS.
//
// Le widget vit dans un processus séparé et ne voit pas l'AsyncStorage de
// l'app : tout passe par l'App Group. Ce module y écrit le JSON d'état, y
// dépose les pochettes en fichiers (WidgetKit ne charge pas d'images distantes
// dans une timeline) et redemande un rendu du widget.
import ExpoModulesCore
import UIKit
import WidgetKit

private let appGroupIdentifier = "group.com.erwinsicot.youtubeclient"
private let payloadKey = "widgetPayload"
// Au-delà, on supprime les pochettes les plus anciennes : le conteneur de
// l'App Group compte dans le stockage de l'app.
private let maxCachedArtworks = 40

public class WidgetDataModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetData")

    /// `true` si l'App Group est accessible : sans lui, rien n'est partageable
    /// et le JS peut cesser d'appeler `sync`.
    Function("isAvailable") { () -> Bool in
      containerURL() != nil
    }

    /// `artwork` : liste de `{ "file": "<id>.jpg", "url": "https://..." }`.
    /// Les fichiers déjà présents ne sont pas retéléchargés.
    AsyncFunction("sync") { (payload: String, artwork: [[String: String]]) in
      await cacheArtwork(artwork)
      writePayload(payload)
      await reloadWidgets()
    }
  }
}

private func containerURL() -> URL? {
  FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
}

private func artworkDirectory() -> URL? {
  guard let container = containerURL() else {
    return nil
  }
  let directory = container.appendingPathComponent("artwork")
  if !FileManager.default.fileExists(atPath: directory.path) {
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }
  return directory
}

private func writePayload(_ payload: String) {
  UserDefaults(suiteName: appGroupIdentifier)?.set(payload, forKey: payloadKey)
}

private func cacheArtwork(_ artwork: [[String: String]]) async {
  guard let directory = artworkDirectory() else {
    return
  }

  for entry in artwork {
    guard
      let file = entry["file"],
      let urlString = entry["url"],
      let url = URL(string: urlString)
    else {
      continue
    }
    let destination = directory.appendingPathComponent(file)
    if FileManager.default.fileExists(atPath: destination.path) {
      continue
    }
    guard
      let (data, _) = try? await URLSession.shared.data(from: url),
      let image = UIImage(data: data),
      // Réencodé en JPEG : les pochettes YouTube arrivent en WebP, que
      // `UIImage(contentsOfFile:)` ne sait pas relire côté extension.
      let jpeg = image.jpegData(compressionQuality: 0.9)
    else {
      continue
    }
    try? jpeg.write(to: destination)
  }

  pruneArtwork(in: directory)
}

private func pruneArtwork(in directory: URL) {
  guard
    let files = try? FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: [.contentModificationDateKey]
    ),
    files.count > maxCachedArtworks
  else {
    return
  }
  let sorted = files.sorted { lhs, rhs in
    let lhsDate =
      (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate)
      ?? .distantPast
    let rhsDate =
      (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate)
      ?? .distantPast
    return lhsDate > rhsDate
  }
  for file in sorted.dropFirst(maxCachedArtworks) {
    try? FileManager.default.removeItem(at: file)
  }
}

@MainActor
private func reloadWidgets() {
  WidgetCenter.shared.reloadAllTimelines()
}
