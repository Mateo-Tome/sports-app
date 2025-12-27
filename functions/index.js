// functions/index.js (Firebase Functions v2)
// Node 18/20+ compatible

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const cors = require('cors');

// ✅ All functions default to this region unless overridden
setGlobalOptions({ region: 'us-central1' });

admin.initializeApp();

// ✅ CORS middleware
const corsHandler = cors({ origin: true }); // allows localhost + prod domains automatically

function clean(v) {
  return (v ?? '')
    .toString()
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1');
}

function buildB2FileUrl(downloadUrl, bucketName, fileName, authToken) {
  const safeName = fileName
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${safeName}?Authorization=${encodeURIComponent(
    authToken
  )}`;
}

/**
 * Shared helper: authorize B2 + create a short-lived download authorization token
 * Returns { downloadUrl, downloadAuthToken, expiresInSec }
 */
async function getB2DownloadAuth() {
  const B2_KEY_ID = clean(process.env.B2_KEY_ID);
  const B2_APP_KEY = clean(process.env.B2_APP_KEY);
  const B2_BUCKET_ID = clean(process.env.B2_BUCKET_ID);

  if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID) {
    const missing = {
      hasB2KeyId: !!B2_KEY_ID,
      hasB2AppKey: !!B2_APP_KEY,
      hasB2BucketId: !!B2_BUCKET_ID,
    };
    const err = new Error(`Missing B2 env vars: ${JSON.stringify(missing)}`);
    err.code = 'MISSING_ENV';
    throw err;
  }

  // ---- Backblaze authorize ----
  const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');

  const authRes = await fetch('https://api.backblazeb2.com/b2api/v1/b2_authorize_account', {
    method: 'GET',
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  const authJson = await authRes.json().catch(() => ({}));
  if (!authRes.ok) {
    const err = new Error('b2_authorize_account failed');
    err.code = 'B2_AUTH_FAILED';
    err.details = authJson;
    throw err;
  }

  const apiUrl = authJson.apiUrl;
  const downloadUrl = authJson.downloadUrl;
  const authToken = authJson.authorizationToken;

  if (!apiUrl || !downloadUrl || !authToken) {
    const err = new Error('Missing apiUrl/downloadUrl/token from B2 auth');
    err.code = 'B2_AUTH_MISSING_FIELDS';
    err.details = authJson;
    throw err;
  }

  // ---- Temporary download authorization ----
  const MAX_SEC = 7 * 24 * 60 * 60; // 604800
  const REQUESTED_SEC = 60 * 60; // 1 hour
  const expiresInSec = Math.min(REQUESTED_SEC, MAX_SEC);

  const prefix = 'videos/';

  const daRes = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: prefix,
      validDurationInSeconds: expiresInSec,
    }),
  });

  const daJson = await daRes.json().catch(() => ({}));
  if (!daRes.ok) {
    const err = new Error('b2_get_download_authorization failed');
    err.code = 'B2_DL_AUTH_FAILED';
    err.details = daJson;
    throw err;
  }

  const downloadAuthToken = daJson.authorizationToken;
  if (!downloadAuthToken) {
    const err = new Error('Missing download authorizationToken');
    err.code = 'B2_DL_AUTH_MISSING_TOKEN';
    err.details = daJson;
    throw err;
  }

  return { downloadUrl, downloadAuthToken, expiresInSec };
}

/**
 * Existing: returns signed URLs for mp4 + json
 */
exports.getPlaybackUrls = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const shareId = (req.query.shareId ?? '').toString().trim();
      if (!shareId) return res.status(400).json({ error: 'Missing shareId' });

      // ---- Read shareIndex/{shareId} ----
      const shareRef = admin.firestore().doc(`shareIndex/${shareId}`);
      const shareSnap = await shareRef.get();
      if (!shareSnap.exists) return res.status(404).json({ error: 'Share not found' });

      const share = shareSnap.data() || {};
      if (share.isPublic !== true) return res.status(403).json({ error: 'Not public' });

      const videoId = share.videoId;
      if (!videoId) return res.status(500).json({ error: 'shareIndex missing videoId' });

      // ---- Read videos/{videoId} ----
      const vidRef = admin.firestore().doc(`videos/${videoId}`);
      const vidSnap = await vidRef.get();
      if (!vidSnap.exists) return res.status(404).json({ error: 'Video not found' });

      const v = vidSnap.data() || {};
      const b2VideoKey = v.b2VideoKey;
      const b2SidecarKey = v.b2SidecarKey;

      if (!b2VideoKey) return res.status(500).json({ error: 'Video missing b2VideoKey' });
      if (!b2SidecarKey) return res.status(500).json({ error: 'Video missing b2SidecarKey' });

      if (v.shareId && v.shareId !== shareId) {
        return res.status(403).json({ error: 'shareId mismatch' });
      }

      const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);
      if (!B2_BUCKET_NAME) return res.status(500).json({ error: 'Missing B2_BUCKET_NAME env var' });

      const { downloadUrl, downloadAuthToken, expiresInSec } = await getB2DownloadAuth();

      const videoUrl = buildB2FileUrl(downloadUrl, B2_BUCKET_NAME, b2VideoKey, downloadAuthToken);
      const sidecarUrl = buildB2FileUrl(downloadUrl, B2_BUCKET_NAME, b2SidecarKey, downloadAuthToken);

      return res.json({
        message: 'OK',
        shareId,
        videoId,
        expiresInSec,
        videoUrl,
        sidecarUrl,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'Internal server error',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/**
 * NEW: Proxy the sidecar JSON to avoid browser CORS issues.
 * Client should fetch:
 *   /getSidecar?shareId=...
 * and this function will fetch the JSON from B2 server-side and return it.
 */
exports.getSidecar = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const shareId = (req.query.shareId ?? '').toString().trim();
      if (!shareId) return res.status(400).json({ error: 'Missing shareId' });

      // ---- Read shareIndex/{shareId} ----
      const shareRef = admin.firestore().doc(`shareIndex/${shareId}`);
      const shareSnap = await shareRef.get();
      if (!shareSnap.exists) return res.status(404).json({ error: 'Share not found' });

      const share = shareSnap.data() || {};
      if (share.isPublic !== true) return res.status(403).json({ error: 'Not public' });

      const videoId = share.videoId;
      if (!videoId) return res.status(500).json({ error: 'shareIndex missing videoId' });

      // ---- Read videos/{videoId} ----
      const vidRef = admin.firestore().doc(`videos/${videoId}`);
      const vidSnap = await vidRef.get();
      if (!vidSnap.exists) return res.status(404).json({ error: 'Video not found' });

      const v = vidSnap.data() || {};
      const b2SidecarKey = v.b2SidecarKey;
      if (!b2SidecarKey) return res.status(500).json({ error: 'Video missing b2SidecarKey' });

      const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);
      if (!B2_BUCKET_NAME) return res.status(500).json({ error: 'Missing B2_BUCKET_NAME env var' });

      const { downloadUrl, downloadAuthToken } = await getB2DownloadAuth();
      const sidecarUrl = buildB2FileUrl(downloadUrl, B2_BUCKET_NAME, b2SidecarKey, downloadAuthToken);

      // Fetch server-side (no browser CORS)
      const r = await fetch(sidecarUrl, { method: 'GET' });
      const text = await r.text();

      // Return as JSON (even if B2 returns text, it’s JSON content)
      res.setHeader('Content-Type', 'application/json');
      return res.status(r.status).send(text);
    } catch (e) {
      return res.status(500).json({
        error: 'getSidecar failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});
