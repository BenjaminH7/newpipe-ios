import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import { BOOTSTRAP_HTML, handleMessage, markReady, registerWebView } from './jsEngine';

/**
 * Monte une fois, au niveau racine de l'app, une WebView invisible qui sert de
 * moteur JS "réel" pour BotGuard et le déchiffrement des flux YouTube. Le
 * `baseUrl` sur youtube.com est nécessaire : le code BotGuard vérifie son
 * origine d'exécution.
 */
export function JsEngineView() {
  const ref = useRef<WebView>(null);

  return (
    <WebView
      ref={(instance) => {
        ref.current = instance;
        if (instance) registerWebView(instance);
      }}
      source={{ html: BOOTSTRAP_HTML, baseUrl: 'https://www.youtube.com' }}
      onLoadEnd={markReady}
      onMessage={handleMessage}
      javaScriptEnabled
      style={styles.hidden}
      // react-native-webview wraps the native view in its own outer <View>, styled
      // separately via `containerStyle` (defaults to flex: 1). Without this, that
      // wrapper stays in normal flow as a flex:1 sibling and claims half the screen
      // from the root layout, regardless of `style` on the WebView itself.
      containerStyle={styles.hidden}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
