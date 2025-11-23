// react-native.config.js
module.exports = {
    dependencies: {
      // Disable iOS autolinking for ffmpeg-kit-react-native.
      'ffmpeg-kit-react-native': {
        platforms: {
          ios: null, // 👈 this is the key line
        },
      },
    },
  };
  