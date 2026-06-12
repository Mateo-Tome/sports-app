import { db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'quickclip_device_id_v1';
const ACTIVE_WINDOW_DAYS = 30;

export type RegisteredDevice = {
  id: string;
  platform: string;
  deviceName: string;
  modelName: string;
  appVersion: string;
  lastSeenAt?: any;
  createdAt?: any;
};

function makeDeviceId() {
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getLocalDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!id) {
    id = makeDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }

  return id;
}

export async function registerCurrentDevice(uid: string) {
  const deviceId = await getLocalDeviceId();

  const ref = doc(db, 'users', uid, 'devices', deviceId);

  const data: RegisteredDevice = {
    id: deviceId,
    platform: Platform.OS,
    deviceName: Device.deviceName ?? 'Unknown device',
    modelName: Device.modelName ?? 'Unknown model',
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    lastSeenAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, data, { merge: true });

  return deviceId;
}

export async function getActiveDeviceCount(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'devices'));

  const now = Date.now();
  const activeMs = ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  let active = 0;

  snap.forEach((d) => {
    const data = d.data();
    const lastSeen = data?.lastSeenAt?.toMillis?.();

    if (!lastSeen) return;

    if (now - lastSeen <= activeMs) {
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