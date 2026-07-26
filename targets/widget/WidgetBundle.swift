import SwiftUI
import WidgetKit

@main
struct MP3WidgetBundle: WidgetBundle {
  var body: some Widget {
    NowPlayingWidget()
    RecentWidget()
    LockScreenWidget()
  }
}
