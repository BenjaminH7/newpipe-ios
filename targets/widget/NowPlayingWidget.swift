// Widget « En cours de lecture » : pochette + titre + artiste de la piste
// courante. Un tap ouvre le lecteur.
import SwiftUI
import WidgetKit

struct NowPlayingEntry: TimelineEntry {
  let date: Date
  let payload: WidgetPayload
}

struct NowPlayingProvider: TimelineProvider {
  func placeholder(in context: Context) -> NowPlayingEntry {
    NowPlayingEntry(date: Date(), payload: .empty)
  }

  func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
    completion(NowPlayingEntry(date: Date(), payload: SharedStore.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
    // Une seule entrée, jamais réactualisée d'elle-même : c'est l'app qui
    // appelle reloadAllTimelines à chaque changement de piste.
    let entry = NowPlayingEntry(date: Date(), payload: SharedStore.read())
    completion(Timeline(entries: [entry], policy: .never))
  }
}

struct NowPlayingWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: NowPlayingEntry

  private var track: WidgetTrack? { entry.payload.nowPlaying }

  var body: some View {
    Group {
      if let track {
        switch family {
        case .systemSmall:
          smallLayout(track)
        default:
          mediumLayout(track)
        }
      } else {
        EmptyState()
      }
    }
    .widgetURL(playerURL)
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
  }

  private func mediumLayout(_ track: WidgetTrack) -> some View {
    HStack(spacing: 14) {
      Cover(track: track)
        .aspectRatio(1, contentMode: .fit)

      VStack(alignment: .leading, spacing: 5) {
        Label(
          entry.payload.isPlaying ? "En lecture" : "En pause",
          systemImage: entry.payload.isPlaying ? "waveform" : "pause.fill"
        )
        .font(.system(size: 10, weight: .bold))
        .textCase(.uppercase)
        .foregroundStyle(Color("$accent"))

        Text(track.title)
          .font(.system(size: 17, weight: .heavy))
          .lineLimit(2)

        Text(track.artist)
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(.secondary)
          .lineLimit(1)

        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct EmptyState: View {
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "music.note")
        .font(.system(size: 26, weight: .semibold))
        .foregroundStyle(Color("$accent"))
      Text("Rien en lecture")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct NowPlayingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NowPlayingWidget", provider: NowPlayingProvider()) { entry in
      NowPlayingWidgetView(entry: entry)
    }
    .configurationDisplayName("En cours de lecture")
    .description("La piste que tu écoutes, à portée de pouce.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
