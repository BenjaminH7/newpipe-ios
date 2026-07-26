// Écran verrouillé / Centre de contrôle : boutons « piste précédente » et
// « piste suivante » à la place des sauts ±10 s.
//
// Pourquoi du natif : expo-video enregistre en dur skipForwardCommand et
// skipBackwardCommand dans son NowPlayingManager et n'enregistre jamais
// nextTrackCommand / previousTrackCommand. Côté JS il n'expose que
// `showNowPlayingNotification`, donc rien ne permet de changer ça.
// MPRemoteCommandCenter étant un singleton système, ce module s'y greffe :
// il désactive les commandes de saut (iOS masque alors leurs boutons) et
// branche les commandes de piste sur des événements remontés au lecteur JS.
import ExpoModulesCore
import MediaPlayer

public class NowPlayingControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("NowPlayingControls")

    Events("onNextTrack", "onPreviousTrack")

    OnCreate {
      self.installCommands()
    }

    // expo-video refait un removeTarget/addTarget sur ses commandes à chaque
    // changement de piste. Il ne touche pas à `isEnabled`, donc nos réglages
    // tiennent — mais le lecteur JS rappelle ce refresh à chaque piste pour
    // rester robuste si ce comportement changeait dans une future version.
    Function("refresh") {
      self.applyCommandAvailability()
    }

    OnDestroy {
      let commandCenter = MPRemoteCommandCenter.shared()
      commandCenter.nextTrackCommand.removeTarget(self.nextTarget)
      commandCenter.previousTrackCommand.removeTarget(self.previousTarget)
    }
  }

  private func installCommands() {
    // Comme dans expo-video : ajouter/retirer des cibles doit se faire sur la
    // main queue, sinon on tombe dans des courses avec removeTarget.
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }
      let commandCenter = MPRemoteCommandCenter.shared()

      self.nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
        guard let self else {
          return .commandFailed
        }
        self.sendEvent("onNextTrack")
        return .success
      }

      self.previousTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
        guard let self else {
          return .commandFailed
        }
        self.sendEvent("onPreviousTrack")
        return .success
      }

      self.applyCommandAvailability()
    }
  }

  private func applyCommandAvailability() {
    let commandCenter = MPRemoteCommandCenter.shared()
    commandCenter.nextTrackCommand.isEnabled = true
    commandCenter.previousTrackCommand.isEnabled = true
    commandCenter.skipForwardCommand.isEnabled = false
    commandCenter.skipBackwardCommand.isEnabled = false
  }
}
