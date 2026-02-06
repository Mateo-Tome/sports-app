// lib/revenuecat.ts
import { Platform } from 'react-native';

// IMPORTANT: do NOT import react-native-purchases at top-level on web
let Purchases: any = null;

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export function isNativePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getPlatformApiKey() {
  if (Platform.OS === 'ios') return IOS_API_KEY;
  if (Platform.OS === 'android') return ANDROID_API_KEY;
  return undefined;
}

let _configured = false;

export async function configureRevenueCat(appUserId?: string | null) {
  if (!isNativePlatform()) return;
  if (_configured) return;

  const apiKey = getPlatformApiKey();

  if (!apiKey) {
    console.warn(
      `[RevenueCat] Missing API key for ${Platform.OS}. ` +
        `Set EXPO_PUBLIC_REVENUECAT_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}_KEY in .env`
    );
    return;
  }

  // Lazy import so it doesn't run before native is ready
  if (!Purchases) {
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
  }

  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

  Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });

  _configured = true;
}

export async function getCustomerInfo() {
  if (!isNativePlatform()) return null;

  if (!Purchases) {
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
  }

  return Purchases.getCustomerInfo();
}
