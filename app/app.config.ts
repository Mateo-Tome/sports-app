// REMOVE the dotenv import entirely! It is causing the crash.

export default ({ config }: any) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    firebase: {
      // These will be pulled automatically from your .env file locally 
      // or from EAS Secrets during a cloud build.
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
  },
});