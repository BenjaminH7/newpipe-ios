# Expo HAS CHANGED

This project is pinned to Expo SDK 54, not the newest SDK. Newer SDKs (55/56/57) require
a custom Expo Go build (`eas go`) or a dev client, because the public Expo Go app on the
App Store / Play Store lags behind on Apple/Google review approval. SDK 54 is what the
public Expo Go app currently supports, so physical-device testing via plain Expo Go needs
this pin. Don't `npx expo install --fix` or bump `expo` past `~54.x` without checking
whether the public Expo Go app has caught up.

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Local native module: `modules/now-playing-controls`

The lock screen / Control Center shows *previous track* and *next track* instead of the
±10 s skip buttons expo-video hardcodes. That required native code (`MPRemoteCommandCenter`
is a system singleton and expo-video 3.0.16 exposes no JS knob for it), so the app now
carries a local Expo module, autolinked from `modules/` on prebuild.

Consequence for the pin above: this module is **not** in the public Expo Go binary. In plain
Expo Go the JS side degrades to a no-op (`requireOptionalNativeModule` returns `null`) and the
lock screen keeps expo-video's skip buttons — everything else still works. To exercise the
feature on device, use `npx expo run:ios` or an EAS build (the `development` profile builds a
dev client). SDK 54 is still worth keeping for the rest of the Expo Go workflow.
