import AsyncStorage from "@react-native-async-storage/async-storage";

const UPLOAD_QUEUE_KEY = "quickclip:uploadQueue:v1";

export type UploadQueueStatus =
  | "pending"
  | "uploading"
  | "failed"
  | "uploaded"
  | "canceled";

export type UploadQueueRecord = {
  localUri: string;
  status: UploadQueueStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string | null;
  cloudKey?: string | null;
  url?: string | null;
};

async function readQueue(): Promise<UploadQueueRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(records: UploadQueueRecord[]) {
  await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(records));
}

function now() {
  return Date.now();
}

export async function getUploadQueueRecord(
  localUri: string
): Promise<UploadQueueRecord | null> {
  const records = await readQueue();
  return records.find((r) => r.localUri === localUri) ?? null;
}

export async function markUploadPending(localUri: string) {
  const records = await readQueue();
  const t = now();
  const existing = records.find((r) => r.localUri === localUri);

  if (existing) {
    existing.status = "pending";
    existing.updatedAt = t;
    existing.lastError = null;
  } else {
    records.unshift({
      localUri,
      status: "pending",
      createdAt: t,
      updatedAt: t,
      attempts: 0,
      lastError: null,
      cloudKey: null,
      url: null,
    });
  }

  await writeQueue(records);
}

export async function markUploadStarted(localUri: string) {
  const records = await readQueue();
  const t = now();
  const existing = records.find((r) => r.localUri === localUri);

  if (existing) {
    existing.status = "uploading";
    existing.updatedAt = t;
    existing.attempts = (existing.attempts ?? 0) + 1;
    existing.lastError = null;
  } else {
    records.unshift({
      localUri,
      status: "uploading",
      createdAt: t,
      updatedAt: t,
      attempts: 1,
      lastError: null,
      cloudKey: null,
      url: null,
    });
  }

  await writeQueue(records);
}

export async function markUploadFailed(localUri: string, error: string) {
  const records = await readQueue();
  const t = now();
  const existing = records.find((r) => r.localUri === localUri);

  if (existing) {
    existing.status = "failed";
    existing.updatedAt = t;
    existing.lastError = error;
  } else {
    records.unshift({
      localUri,
      status: "failed",
      createdAt: t,
      updatedAt: t,
      attempts: 1,
      lastError: error,
      cloudKey: null,
      url: null,
    });
  }

  await writeQueue(records);
}

export async function markUploadCanceled(localUri: string) {
  const records = await readQueue();
  const t = now();
  const existing = records.find((r) => r.localUri === localUri);

  if (existing) {
    existing.status = "canceled";
    existing.updatedAt = t;
    existing.lastError = null;
  } else {
    records.unshift({
      localUri,
      status: "canceled",
      createdAt: t,
      updatedAt: t,
      attempts: 0,
      lastError: null,
      cloudKey: null,
      url: null,
    });
  }

  await writeQueue(records);
}

export async function markUploadSucceeded(params: {
  localUri: string;
  cloudKey: string;
  url: string;
}) {
  const records = await readQueue();
  const t = now();
  const existing = records.find((r) => r.localUri === params.localUri);

  if (existing) {
    existing.status = "uploaded";
    existing.updatedAt = t;
    existing.lastError = null;
    existing.cloudKey = params.cloudKey;
    existing.url = params.url;
  } else {
    records.unshift({
      localUri: params.localUri,
      status: "uploaded",
      createdAt: t,
      updatedAt: t,
      attempts: 1,
      lastError: null,
      cloudKey: params.cloudKey,
      url: params.url,
    });
  }

  await writeQueue(records);
}

export async function markStaleUploadingAsFailed(localUri: string) {
  const records = await readQueue();
  const existing = records.find((r) => r.localUri === localUri);

  if (!existing || existing.status !== "uploading") return existing ?? null;

  const ageMs = now() - existing.updatedAt;

  if (ageMs > 2 * 60 * 1000) {
    existing.status = "failed";
    existing.updatedAt = now();
    existing.lastError =
      "Upload was interrupted. Keep QuickClip open and tap Retry Upload.";
    await writeQueue(records);
  }

  return existing;
}