// Widget « Reprendre l'écoute » : grille de pochettes récentes, façon
// « Recently played » de Spotify. Chaque pochette est un lien qui relance ce
// titre (voir app/play/[id].tsx côté app).
import SwiftUI
import WidgetKit

struct RecentEntry: TimelineEntry {
  let date: Date
  let tracks: [WidgetTrack]
}

struct RecentProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecentEntry {
    RecentEntry(date: Date(), tracks: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (RecentEntry) -> Void) {
    completion(RecentEntry(date: Date(), tracks: SharedStore.read().recent))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecentEntry>) -> Void) {
    let entry = RecentEntry(date: Date(), tracks: SharedStore.read().recent)
    completion(Timeline(entries: [entry], policy: .never))
  }
}

struct RecentWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RecentEntry

  /// 1 pochette en small (le widget entier est le lien), 4 en medium,
  /// 8 en large — deux rangées de quatre.
  private var capacity: Int {
    switch family {
    case .systemSmall: return 1
    case .systemLarge: return 8
    default: return 4
    }
  }

  private var tracks: [WidgetTrack] {
    Array(entry.tracks.prefix(capacity))
  }

  var body: some View {
    Group {
      if tracks.isEmpty {
        VStack(spacing: 8) {
          Image(systemName: "clock.arrow.circlepath")
            .font(.system(size: 26, weight: .semibold))
            .foregroundStyle(Color("$accent"))
          Text("Aucune écoute récente")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(playerURL)
      } else if family == .systemSmall {
        smallLayout(tracks[0])
      } else {
        gridLayout
      }
    }
    .widgetSurface()
  }

  private func smallLayout(_ track: WidgetTrack) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Cover(track: track)
        .frame(maxWidth: .infinity)
      Text(track.title)
        .font(.system(size: 13, weight: .bold))
        .lineLimit(1)
      Text(track.artist)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .widgetURL(playURL(track))
  }

  private var gridLayout: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Reprendre")
        .font(.system(size: 11, weight: .heavy))
        .textCase(.uppercase)
        .kerning(0.8)
        .foregroundStyle(.secondary)

      // Colonnes fixes plutôt qu'adaptatives : sur un widget, une grille
      // adaptative peut retomber sur 3 colonnes et casser l'alignement.
      LazyVGrid(
        columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4),
        spacing: 10
      ) {
        ForEach(tracks) { track in
          if let url = playURL(track) {
            Link(destination: url) {
              Cover(track: track, corner: 6)
                .aspectRatio(1, contentMode: .fit)
            }
          } else {
            Cover(track: track, corner: 6)
              .aspectRatio(1, contentMode: .fit)
          }
        }
      }

      Spacer(minLength: 0)
    }
  }
}

struct RecentWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RecentWidget", provider: RecentProvider()) { entry in
      RecentWidgetView(entry: entry)
    }
    .configurationDisplayName("Reprendre l’écoute")
    .description("Tes dernières écoutes, en un tap.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
