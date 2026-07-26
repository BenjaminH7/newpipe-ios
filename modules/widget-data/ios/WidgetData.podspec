Pod::Spec.new do |s|
  s.name           = 'WidgetData'
  s.version        = '1.0.0'
  s.summary        = 'Alimente les widgets iOS via l’App Group'
  s.description    = 'Écrit la piste en cours et les écoutes récentes dans l’App Group partagé avec l’extension widget, puis recharge ses timelines.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
