# Expo HAS CHANGED

This project is pinned to Expo SDK 54, not the newest SDK. Newer SDKs (55/56/57) require
a custom Expo Go build (`eas go`) or a dev client, because the public Expo Go app on the
App Store / Play Store lags behind on Apple/Google review approval. SDK 54 is what the
public Expo Go app currently supports, so physical-device testing via plain Expo Go needs
this pin. Don't `npx expo install --fix` or bump `expo` past `~54.x` without checking
whether the public Expo Go app has caught up.

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
