/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'mp3widget',
  displayName: '.mp3',
  // iOS 17 : `containerBackground` est obligatoire pour les widgets à partir de
  // cette version, et les accessoires d'écran verrouillé existent depuis iOS 16.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  // Même App Group que l'app : c'est le seul canal par lequel l'extension peut
  // lire ce que le lecteur écrit (l'AsyncStorage de l'app lui est invisible).
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  colors: {
    // Accent de l'app (theme.ts) et fond clair/sombre façon Spotify.
    // Forme attendue par le plugin : { light, dark } — et surtout pas
    // { color, darkColor }, qui produit silencieusement un colorset vide.
    $accent: '#ef4444',
    $widgetBackground: { light: '#f3f3f4', dark: '#121212' },
  },
});
