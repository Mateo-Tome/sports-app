// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * QuickClip Backblaze Upload URL Function (DIAGNOSTIC + WORKING PATH)
 * - Verifies Firebase ID token
 * - Calls b2_authorize_account (v1)
 * - Logs authJson.allowed + env bucket info (NO TOKENS)
 * - Calls b2_get_upload_url (v2)
 *
 * This version includes unmistakable "🔥" logs so we can prove the new code is running.
 */

const FN_VERSION = 'getUploadUrl-v7-🔥-allowed-logs-trim';

function clean(v) {
  // trims whitespace and strips surrounding quotes if someone copied values with quotes
  return (v ?? '')
    .toString()
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1');
}

function safePrefix(str, n = 10) {
  if (!str) return null;
  return str.length <= n ? str : str.slice(0, n) + '…';
}

exports.getUploadUrl = functions.https.onRequest(async (req, res) => {
  // ---- CORS ----
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // 🔥 Proves this exact revision is being hit
  console.log(
    '🔥🔥🔥 QUICKCLIP getUploadUrl HIT —',
    new Date().toISOString(),
    '—',
    FN_VERSION,
  );

  try {
    // ---- Load env INSIDE handler (avoids warm-instance confusion) ----
    const B2_KEY_ID = clean(process.env.B2_KEY_ID);
    const B2_APP_KEY = clean(process.env.B2_APP_KEY);
    const B2_BUCKET_ID = clean(process.env.B2_BUCKET_ID);
    const B2_BUCKET_NAME = clean(process.env.B2_BUCKET_NAME);

    console.log('[getUploadUrl] fnVersion', FN_VERSION);
    console.log('[getUploadUrl] env present', {
      hasKeyId: !!B2_KEY_ID,
      hasAppKey: !!B2_APP_KEY,
      hasBucketId: !!B2_BUCKET_ID,
      hasBucketName: !!B2_BUCKET_NAME,
      bucketIdPrefix: safePrefix(B2_BUCKET_ID, 12),
      bucketName: B2_BUCKET_NAME || null,
    });

    // ---- 1) Verify Firebase ID token ----
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing Authorization header',
        fnVersion: FN_VERSION,
      });
    }

    const idToken = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // ---- 2) Ensure env vars exist ----
    if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
      console.error('[getUploadUrl] Missing B2 env vars');
      return res.status(500).json({
        error:
          'B2 config missing required values (B2_KEY_ID/B2_APP_KEY/B2_BUCKET_ID/B2_BUCKET_NAME).',
        fnVersion: FN_VERSION,
        present: {
          hasKeyId: !!B2_KEY_ID,
          hasAppKey: !!B2_APP_KEY,
          hasBucketId: !!B2_BUCKET_ID,
          hasBucketName: !!B2_BUCKET_NAME,
        },
      });
    }

    // ---- 3) Authorize with Backblaze (B2 native API) ----
    const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString(
      'base64',
    );

    const authRes = await fetch(
      'https://api.backblazeb2.com/b2api/v1/b2_authorize_account',
      {
        method: 'GET',
        headers: { Authorization: `Basic ${basicAuth}` },
      },
    );

    const authJson = await authRes.json();

    console.log(
      '[getUploadUrl] b2_authorize_account status',
      authRes.status,
      'fnVersion',
      FN_VERSION,
    );

    if (!authRes.ok) {
      console.error(
        '[getUploadUrl] b2_authorize_account FAILED',
        authRes.status,
        authJson,
      );
      return res.status(500).json({
        error: 'b2_authorize_account failed',
        fnVersion: FN_VERSION,
        details: authJson,
      });
    }

    // ---- Critical debug: WHAT THE KEY IS ALLOWED TO DO ----
    // DO NOT log tokens. "allowed" is safe and is the key to solving 401.
    console.log(
      '[getUploadUrl] allowed:',
      JSON.stringify(authJson.allowed || null),
    );
    console.log('[getUploadUrl] env bucketId:', B2_BUCKET_ID);
    console.log('[getUploadUrl] env bucketName:', B2_BUCKET_NAME);

    const apiUrl = authJson.apiUrl;
    const authToken = authJson.authorizationToken; // do not log

    if (!apiUrl || !authToken) {
      console.error(
        '[getUploadUrl] Missing apiUrl or authorizationToken in authorize response',
        { hasApiUrl: !!apiUrl, hasAuthToken: !!authToken },
      );
      return res.status(500).json({
        error:
          'Missing apiUrl/authorizationToken in Backblaze authorize response',
        fnVersion: FN_VERSION,
      });
    }

    // ---- Fail-fast checks (common reasons for 401 on get_upload_url) ----
    const allowedBucketId = authJson.allowed?.bucketId || null;
    const allowedBucketName = authJson.allowed?.bucketName || null;
    const allowedCaps = authJson.allowed?.capabilities || [];

    // If the key is restricted to a different bucket, stop right here with a clear error
    if (allowedBucketId && allowedBucketId !== B2_BUCKET_ID) {
      console.error('[getUploadUrl] Bucket mismatch', {
        allowedBucketId,
        envBucketId: B2_BUCKET_ID,
      });

      return res.status(500).json({
        error:
          'Backblaze key is restricted to a different bucketId than your B2_BUCKET_ID env var.',
        fnVersion: FN_VERSION,
        debug: {
          allowedBucketId,
          envBucketId: B2_BUCKET_ID,
          allowedBucketName,
          envBucketName: B2_BUCKET_NAME,
          allowedCaps,
        },
      });
    }

    // If the key can't write files, it will fail to request upload URLs
    if (Array.isArray(allowedCaps) && !allowedCaps.includes('writeFiles')) {
      console.error('[getUploadUrl] Missing writeFiles capability', {
        allowedCaps,
      });

      return res.status(500).json({
        error: 'Backblaze key missing writeFiles capability.',
        fnVersion: FN_VERSION,
        debug: { allowedCaps, allowedBucketId, allowedBucketName },
      });
    }

    // ---- 4) Get upload URL (v2 endpoint) ----
    const uploadRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });

    const uploadJson = await uploadRes.json();

    console.log('[getUploadUrl] b2_get_upload_url status', uploadRes.status);

    if (!uploadRes.ok) {
      console.error(
        '[getUploadUrl] b2_get_upload_url FAILED',
        uploadRes.status,
        uploadJson,
      );

      // Return safe debug to the app (no tokens)
      return res.status(500).json({
        error: 'b2_get_upload_url failed',
        fnVersion: FN_VERSION,
        details: uploadJson,
        debug: {
          envBucketId: B2_BUCKET_ID,
          envBucketName: B2_BUCKET_NAME,
          allowed: authJson.allowed || null,
          apiUrl,
        },
      });
    }

    if (!uploadJson.uploadUrl || !uploadJson.authorizationToken) {
      console.error(
        '[getUploadUrl] Missing uploadUrl/authorizationToken in get_upload_url response',
        uploadJson,
      );
      return res.status(500).json({
        error:
          'Missing uploadUrl/authorizationToken in Backblaze get_upload_url response',
        fnVersion: FN_VERSION,
        details: uploadJson,
      });
    }

    // ---- 5) Return upload URL + upload token to app ----
    return res.json({
      message: 'OK',
      fnVersion: FN_VERSION,
      uid,
      uploadUrl: uploadJson.uploadUrl,
      uploadAuthToken: uploadJson.authorizationToken,
      bucketId: B2_BUCKET_ID,
      bucketName: B2_BUCKET_NAME,
      allowed: authJson.allowed || null,
    });
  } catch (err) {
    console.error('[getUploadUrl] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      fnVersion: FN_VERSION,
      details: err?.message || String(err),
    });
  }
});
