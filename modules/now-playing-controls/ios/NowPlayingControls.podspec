Pod::Spec.new do |s|
  s.name           = 'NowPlayingControls'
  s.version        = '1.0.0'
  s.summary        = 'Piste précédente / suivante sur l’écran verrouillé iOS'
  s.description    = 'Remplace les boutons de saut ±10 s d’expo-video par des commandes piste précédente / piste suivante.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
