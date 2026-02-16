// lib/purchases.ts
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { getPurchases } from './revenuecat';

export const ENTITLEMENT_ID = 'pro';
export const OFFERING_ID = 'default';

export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return null; // RC disabled/unavailable

    const offerings = await Purchases.getOfferings();
    const offering = offerings?.all?.[OFFERING_ID] ?? offerings?.current;
    if (!offering) return null;

    const monthly =
      offering.monthly ??
      offering.availablePackages?.find((p: PurchasesPackage) => p.packageType === 'MONTHLY') ??
      offering.availablePackages?.[0];

    return monthly ?? null;
  } catch (e) {
    // non-fatal: just means purchases are not ready yet
    console.log('[Purchases] getMonthlyPackage unavailable (expected while RC paused)', e);
    return null;
  }
}

export async function purchaseMonthly(): Promise<CustomerInfo | null> {
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return null;

    const pkg = await getMonthlyPackage();
    if (!pkg) return null;

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo ?? null;
  } catch (e) {
    console.log('[Purchases] purchaseMonthly failed (non-fatal while RC paused)', e);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return null;

    return await Purchases.restorePurchases();
  } catch (e) {
    console.log('[Purchases] restorePurchases failed (non-fatal while RC paused)', e);
    return null;
  }
}
