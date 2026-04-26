import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;
let permissionAsked = false;

export async function setupUploadNotifications() {
  if (Platform.OS === "web") return false;

  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    configured = true;
  }

  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted) return true;

  if (permissionAsked) return false;
  permissionAsked = true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function notify(title: string, body: string) {
  try {
    const ok = await setupUploadNotifications();
    if (!ok) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  } catch (err) {
    console.log("[uploadNotifications] notify failed", err);
  }
}

export async function notifyUploadStarted() {
  await notify("QuickClip upload started", "Your clip is uploading.");
}

export async function notifyUploadComplete() {
  await notify("QuickClip upload complete", "Your clip is ready to watch and share.");
}

export async function notifyUploadFailed(message?: string) {
  await notify(
    "QuickClip upload failed",
    message?.trim() || "Your clip did not upload. Open QuickClip to retry."
  );
}

export async function notifyUploadCanceled() {
  await notify("QuickClip upload canceled", "Your clip upload was canceled.");
}