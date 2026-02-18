Pod::Spec.new do |s|
  s.name         = 'ffmpeg-kit-ios-https'
  s.version      = '6.0'
  s.summary      = 'Alias pod that redirects ffmpeg-kit-ios-https to ffmpeg-kit-ios-full'
  s.homepage     = 'https://github.com/arthenica/ffmpeg-kit'
  s.license      = { :type => 'LGPL-3.0' }
  s.author       = { 'FFmpegKit' => 'noreply@example.com' }
  s.platform     = :ios, '12.0'

  # local source so CocoaPods does not download anything
  s.source       = { :path => '.' }

  # make pod valid with at least one file
  s.source_files = 'dummy/**/*.{h,m}'

  # redirect to FULL
  s.dependency 'ffmpeg-kit-ios-full', '6.0'
end
