// lib/purchases.ts
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { getPurchases } from './revenuecat';

export const ENTITLEMENT_ID = 'pro'; // must match RevenueCat entitlement id
export const OFFERING_ID = 'default'; // optional: your offering id in RevenueCat dashboard

export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  const Purchases = await getPurchases();

  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[OFFERING_ID] ?? offerings.current;
  if (!offering) return null;

  const monthly =
    offering.monthly ??
    offering.availablePackages.find((p: PurchasesPackage) => p.packageType === 'MONTHLY') ??
    offering.availablePackages[0];

  return monthly ?? null;
}

export async function purchaseMonthly(): Promise<CustomerInfo> {
  const Purchases = await getPurchases();

  const pkg = await getMonthlyPackage();
  if (!pkg) throw new Error('No subscription package available.');

  const { customerInfo } = await Purchases.purchasePackage(pkg);

  const active = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  if (!active) throw new Error('Purchase completed, but entitlement not active.');

  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const Purchases = await getPurchases();
  return Purchases.restorePurchases();
}
