import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Place toujours réservée au MiniPlayer flottant (carte ~56 + marges), qu'il
// soit affiché ou non : évite un saut de padding quand une piste démarre, et
// surtout évite de dépendre du contexte player (dont la position de lecture
// change à chaque tick et ferait re-rendre tous les écrans).
const MINI_PLAYER_ALLOWANCE = 76;

// La tab bar est translucide et positionnée en absolu (effet verre) : le
// contenu défile dessous. Ce hook fournit aux écrans les décalages du bas :
// - miniPlayerBottom : position du MiniPlayer flottant (au-dessus de la tab
//   bar dans les onglets, au-dessus de l'inset système ailleurs) ;
// - contentBottomPadding : padding de fin de liste pour que le dernier élément
//   ne reste pas caché derrière la tab bar et le MiniPlayer.
export function useBottomOffsets() {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();

  const chromeHeight = tabBarHeight > 0 ? tabBarHeight : insets.bottom;
  return {
    miniPlayerBottom: chromeHeight + 6,
    contentBottomPadding: chromeHeight + MINI_PLAYER_ALLOWANCE,
  };
}
