// Accessoires d'écran verrouillé (iOS 16+). Le système les rend en monochrome
// teinté : une pochette y ressortirait en bouillie grise, donc on mise sur du
// texte et un glyphe plutôt que sur l'image.
import SwiftUI
import WidgetKit

struct LockScreenWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: NowPlayingEntry

  private var track: WidgetTrack? { entry.payload.nowPlaying }

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        circular
      default:
        rectangular
      }
    }
    .widgetURL(playerURL)
    .containerBackground(for: .widget) { Color.clear }
  }

  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      Image(systemName: entry.payload.isPlaying ? "waveform" : "music.note")
        .font(.system(size: 22, weight: .semibold))
    }
  }

  private var rectangular: some View {
    VStack(alignment: .leading, spacing: 1) {
      Label(
        entry.payload.isPlaying ? "En lecture" : "En pause",
        systemImage: entry.payload.isPlaying ? "waveform" : "pause.fill"
      )
      .font(.system(size: 11, weight: .bold))
      .widgetAccentable()

      if let track {
        Text(track.title)
          .font(.system(size: 14, weight: .semibold))
          .lineLimit(1)
        Text(track.artist)
          .font(.system(size: 12))
          .lineLimit(1)
      } else {
        Text("Rien en lecture")
          .font(.system(size: 14, weight: .semibold))
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct LockScreenWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LockScreenWidget", provider: NowPlayingProvider()) { entry in
      LockScreenWidgetView(entry: entry)
    }
    .configurationDisplayName("Lecture en cours")
    .description("Ce que tu écoutes, sur l’écran verrouillé.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
