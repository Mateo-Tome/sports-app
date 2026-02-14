// lib/revenuecat.ts
import { Platform } from 'react-native';

// IMPORTANT: do NOT import react-native-purchases at top-level (esp. web / release boot)
let Purchases: any = null;

// Keys (optional; we skip if missing)
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

/**
 * Safety switch:
 * - In RELEASE/TestFlight: RevenueCat is OFF by default unless EXPO_PUBLIC_ENABLE_REVENUECAT=1
 * - In DEV: RevenueCat can run (if keys exist)
 */
const RC_ENABLED = process.env.EXPO_PUBLIC_ENABLE_REVENUECAT === '1';

export function isNativePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isRcAllowedRightNow() {
  // In dev, allow.
  // In release, only allow if explicitly enabled.
  return __DEV__ || RC_ENABLED;
}

function getPlatformApiKey() {
  if (Platform.OS === 'ios') return IOS_API_KEY;
  if (Platform.OS === 'android') return ANDROID_API_KEY;
  return undefined;
}

let _configured = false;

/**
 * Lazy-load Purchases safely.
 * Returns null if unavailable/disabled.
 */
async function safeGetPurchases(): Promise<any | null> {
  try {
    if (!isNativePlatform()) return null;
    if (!isRcAllowedRightNow()) return null;

    if (Purchases) return Purchases;

    const mod: any = await import('react-native-purchases');
    Purchases = mod?.default ?? mod;

    if (!Purchases) {
      console.log('[RevenueCat] Purchases module loaded but was empty. Skipping.');
      return null;
    }

    return Purchases;
  } catch (e) {
    console.log('[RevenueCat] Failed to load react-native-purchases (non-fatal):', e);
    return null;
  }
}

/**
 * Exported for other modules (like lib/purchases.ts).
 * Throws a friendly error if RC is disabled/unavailable, instead of crashing with undefined.
 */
export async function getPurchases(): Promise<any> {
  const P = await safeGetPurchases();
  if (!P) {
    throw new Error(
      '[RevenueCat] Purchases is disabled/unavailable (release disabled unless EXPO_PUBLIC_ENABLE_REVENUECAT=1).'
    );
  }
  return P;
}

/**
 * Configure RevenueCat exactly once per JS runtime.
 * MUST NEVER crash the app.
 */
export async function configureRevenueCat(appUserId?: string | null) {
  try {
    if (!isNativePlatform()) return;

    if (!isRcAllowedRightNow()) {
      console.log('[RevenueCat] Disabled in release (set EXPO_PUBLIC_ENABLE_REVENUECAT=1 to enable).');
      return;
    }

    if (_configured) return;

    const apiKey = getPlatformApiKey();
    if (!apiKey) {
      console.log(`[RevenueCat] Missing API key for ${Platform.OS}. Skipping configure.`);
      return;
    }

    const P = await safeGetPurchases();
    if (!P) return;

    // Debug logs in dev only
    try {
      if (__DEV__ && P?.LOG_LEVEL?.DEBUG) {
        P.setLogLevel(P.LOG_LEVEL.DEBUG);
      }
    } catch {}

    try {
      P.configure({
        apiKey,
        appUserID: appUserId ?? undefined,
      });

      _configured = true;
      console.log('[RevenueCat] Configured (safe).');
    } catch (e) {
      console.log('[RevenueCat] Purchases.configure failed (non-fatal):', e);
    }
  } catch (e) {
    console.log('[RevenueCat] configureRevenueCat unexpected error (non-fatal):', e);
  }
}

export async function getCustomerInfo() {
  try {
    if (!isNativePlatform()) return null;
    if (!isRcAllowedRightNow()) return null;

    const P = await safeGetPurchases();
    if (!P) return null;

    return await P.getCustomerInfo();
  } catch (e) {
    console.log('[RevenueCat] getCustomerInfo failed (non-fatal):', e);
    return null;
  }
}
