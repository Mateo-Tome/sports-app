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
const corsHandler = cors({ origin: true }); // or '*' if you prefer

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

exports.getPlaybackUrls = onRequest(async (req, res) => {
  // Let the cors middleware handle OPTIONS + headers
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Use GET' });
      }

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

      // ---- Backblaze env vars ----
      const B2_KEY_ID = clean(process.env.B2_KEY_ID);
      const B2_APP_KEY = clean(process.env.B2_APP_KEY);
      const B2_BUCKET_ID = clean(process.env.B2_BUCKET_ID);
      const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);

      if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
        return res.status(500).json({ error: 'Missing B2 env vars' });
      }

      // ---- Backblaze authorize ----
      const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');

      const authRes = await fetch('https://api.backblazeb2.com/b2api/v1/b2_authorize_account', {
        method: 'GET',
        headers: { Authorization: `Basic ${basicAuth}` },
      });

      const authJson = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        return res.status(500).json({ error: 'b2_authorize_account failed', details: authJson });
      }

      const apiUrl = authJson.apiUrl;
      const downloadUrl = authJson.downloadUrl;
      const authToken = authJson.authorizationToken;

      if (!apiUrl || !downloadUrl || !authToken) {
        return res.status(500).json({ error: 'Missing apiUrl/downloadUrl/token from B2 auth' });
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
        return res.status(500).json({ error: 'b2_get_download_authorization failed', details: daJson });
      }

      const downloadAuthToken = daJson.authorizationToken;
      if (!downloadAuthToken) {
        return res.status(500).json({ error: 'Missing download authorizationToken' });
      }

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
      return res.status(500).json({ error: 'Internal server error', details: String(e?.message || e) });
    }
  });
});
