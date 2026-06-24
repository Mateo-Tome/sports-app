import { db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'quickclip_device_id_v2';

export type RegisteredDevice = {
  id: string;
  platform: string;
  deviceName: string;
  modelName: string;
  appVersion: string;
  isActive?: boolean;
  lastSeenAt?: any;
  signedInAt?: any;
  signedOutAt?: any;
  createdAt?: any;
};

function cleanIdPart(v: string) {
  return v.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function getStableNativeDeviceId() {
  if (Platform.OS === 'android') {
    const androidId = await Application.getAndroidId();

    if (androidId) {
      return `android_${cleanIdPart(androidId)}`;
    }
  }

  if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync();

    if (iosId) {
      return `ios_${cleanIdPart(iosId)}`;
    }
  }

  return null;
}

function makeFallbackDeviceId() {
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getLocalDeviceId() {
  const nativeId = await getStableNativeDeviceId();

  if (nativeId) {
    await AsyncStorage.setItem(DEVICE_ID_KEY, nativeId);
    return nativeId;
  }

  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!id) {
    id = makeFallbackDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }

  return id;
}

async function cleanupDuplicateDeviceDocs(uid: string, currentDeviceId: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'devices'));

  const currentPlatform = Platform.OS;
  const currentDeviceName = Device.deviceName ?? 'Unknown device';
  const currentModelName = Device.modelName ?? 'Unknown model';

  const deletes: Promise<void>[] = [];

  snap.forEach((d) => {
    if (d.id === currentDeviceId) return;

    const data = d.data();

    const samePhysicalDevice =
      data?.platform === currentPlatform &&
      data?.deviceName === currentDeviceName &&
      data?.modelName === currentModelName;

    if (samePhysicalDevice) {
      deletes.push(deleteDoc(doc(db, 'users', uid, 'devices', d.id)));
    }
  });

  await Promise.all(deletes);
}

export async function registerCurrentDevice(uid: string) {
  const deviceId = await getLocalDeviceId();

  await cleanupDuplicateDeviceDocs(uid, deviceId);

  const ref = doc(db, 'users', uid, 'devices', deviceId);

  const data: RegisteredDevice = {
    id: deviceId,
    platform: Platform.OS,
    deviceName: Device.deviceName ?? 'Unknown device',
    modelName: Device.modelName ?? 'Unknown model',
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    isActive: true,
    lastSeenAt: serverTimestamp(),
    signedInAt: serverTimestamp(),
    signedOutAt: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, data, { merge: true });

  return deviceId;
}

export async function signOutCurrentDevice(uid: string) {
  const deviceId = await getLocalDeviceId();

  const ref = doc(db, 'users', uid, 'devices', deviceId);

  await setDoc(
    ref,
    {
      isActive: false,
      signedOutAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );

  return deviceId;
}

export async function getActiveDeviceCount(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'devices'));

  let active = 0;

  snap.forEach((d) => {
    const data = d.data();

    if (data?.isActive === true) {
      active += 1;
    }
  });

  return active;
}

export async function getDeviceUsage(uid: string, maxDevices: number) {
  try {
    await registerCurrentDevice(uid);
    const activeDeviceCount = await getActiveDeviceCount(uid);

    return {
      activeDeviceCount,
      maxDevices,
      text: `${Math.min(activeDeviceCount, maxDevices)} / ${maxDevices}`,
      isOverLimit: activeDeviceCount > maxDevices,
    };
  } catch (e) {
    console.log('[devices] device usage failed:', e);

    return {
      activeDeviceCount: 1,
      maxDevices,
      text: `1 / ${maxDevices}`,
      isOverLimit: false,
    };
  }
}