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

// ⚠️ NOTE: This creates a URL with Authorization in the query string (good for quick testing,
// but NOT ideal for long-term CDN caching). We'll keep it for now because your app already uses it.
function buildB2FileUrl(downloadUrl, bucketName, fileName, authToken) {
  const safeName = fileName
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${safeName}?Authorization=${encodeURIComponent(
    authToken
  )}`;
}

// ✅ NEW: Build Cloudflare CDN URL for a B2 object key like "videos/<uid>/<file>.mp4"
function buildCdnUrl(fileKey, b2DownloadAuthToken) {
  const CDN_BASE = 'https://media.quickclipapp.com';

  // fileKey already looks like: videos/.../file.mp4
  // Keep the path as-is, only ensure no leading slash
  const path = String(fileKey || '').replace(/^\/+/, '');

  // Token gets appended as query param (Worker reads it and adds B2 Authorization header)
  return `${CDN_BASE}/${path}?token=${encodeURIComponent(b2DownloadAuthToken)}`;
}

/**
 * Shared helper: authorize B2 + create a short-lived download authorization token.
 * Returns { downloadUrl, downloadAuthToken, expiresInSec }
 *
 * This token can be scoped to:
 * - 'videos/' (broad)
 * - or 'videos/<uid>/<file>' (single file) depending on prefix passed
 */
async function getB2DownloadAuth(prefix = 'videos/', expiresInSec = 60 * 60) {
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
  const safeExpires = Math.min(expiresInSec, MAX_SEC);

  const daRes = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: prefix,
      validDurationInSeconds: safeExpires,
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

  return { downloadUrl, downloadAuthToken, expiresInSec: safeExpires };
}

/**
 * ✅ UPDATED: returns Cloudflare CDN URLs for mp4 + json (public share flow)
 *
 * Your app overlays/event belt continue to work because the app still loads:
 * - videoUrl (mp4)
 * - sidecarUrl (json)
 *
 * Now both are served via Cloudflare:
 *   https://media.quickclipapp.com/videos/...mp4?token=...
 *   https://media.quickclipapp.com/videos/...json?token=...
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

      // Broad token (videos/) for public share viewing
      const { downloadAuthToken, expiresInSec } = await getB2DownloadAuth('videos/', 60 * 60);

      // ✅ Return CDN URLs (not raw B2)
      const videoUrl = buildCdnUrl(b2VideoKey, downloadAuthToken);
      const sidecarUrl = buildCdnUrl(b2SidecarKey, downloadAuthToken);

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
 * Existing: Proxy the sidecar JSON to avoid browser CORS issues.
 * (You may not need this anymore if your Worker sets CORS headers for JSON too,
 * but keeping it won’t hurt.)
 */
exports.getSidecar = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const shareId = (req.query.shareId ?? '').toString().trim();
      if (!shareId) return res.status(400).json({ error: 'Missing shareId' });

      const shareRef = admin.firestore().doc(`shareIndex/${shareId}`);
      const shareSnap = await shareRef.get();
      if (!shareSnap.exists) return res.status(404).json({ error: 'Share not found' });

      const share = shareSnap.data() || {};
      if (share.isPublic !== true) return res.status(403).json({ error: 'Not public' });

      const videoId = share.videoId;
      if (!videoId) return res.status(500).json({ error: 'shareIndex missing videoId' });

      const vidRef = admin.firestore().doc(`videos/${videoId}`);
      const vidSnap = await vidRef.get();
      if (!vidSnap.exists) return res.status(404).json({ error: 'Video not found' });

      const v = vidSnap.data() || {};
      const b2SidecarKey = v.b2SidecarKey;
      if (!b2SidecarKey) return res.status(500).json({ error: 'Video missing b2SidecarKey' });

      const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);
      if (!B2_BUCKET_NAME) return res.status(500).json({ error: 'Missing B2_BUCKET_NAME env var' });

      const { downloadUrl, downloadAuthToken } = await getB2DownloadAuth('videos/', 60 * 60);
      const sidecarUrl = buildB2FileUrl(downloadUrl, B2_BUCKET_NAME, b2SidecarKey, downloadAuthToken);

      const r = await fetch(sidecarUrl, { method: 'GET' });
      const text = await r.text();

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

/**
 * NEW (owner playback for CDN): return a short-lived B2 download auth token for ONE file path
 *
 * Worker/App calls:
 *   GET /getB2DownloadAuthForPath?path=videos/<uid>/<file>
 * with header:
 *   Authorization: Bearer <Firebase ID token>
 *
 * Returns:
 *   { downloadUrl, bucketName, authToken, expiresInSec }
 */
exports.getB2DownloadAuthForPath = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      // 1) Verify Firebase ID token
      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      // 2) Validate requested path
      const path = (req.query.path ?? '').toString().trim();
      if (!path.startsWith('videos/')) return res.status(400).json({ error: 'Invalid path' });

      // 3) Owner-only: videos/<uid>/...
      const parts = path.split('/');
      const uidInPath = parts[1];
      if (!uidInPath || uidInPath !== uid) return res.status(403).json({ error: 'Forbidden' });

      const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);
      if (!B2_BUCKET_NAME) return res.status(500).json({ error: 'Missing B2_BUCKET_NAME env var' });

      // Token scoped to THIS file path (mp4/json/etc)
      const expiresInSec = 60 * 30;
      const { downloadUrl, downloadAuthToken } = await getB2DownloadAuth(path, expiresInSec);

      return res.json({
        downloadUrl,
        bucketName: B2_BUCKET_NAME,
        authToken: downloadAuthToken,
        expiresInSec,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'getB2DownloadAuthForPath failed',
        details: String(e?.message || e),
      });
    }
  });
});
