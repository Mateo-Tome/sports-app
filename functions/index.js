// functions/index.js (Firebase Functions v2)
// Node 18/20+ compatible

const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
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

// ✅ Build Cloudflare CDN URL for a B2 object key like "videos/<uid>/.../file.jpg"
function buildCdnUrl(fileKey, b2DownloadAuthToken) {
  const CDN_BASE = 'https://media.quickclipapp.com';
  const path = String(fileKey || '').replace(/^\/+/, '');
  return `${CDN_BASE}/${path}?token=${encodeURIComponent(b2DownloadAuthToken)}`;
}

function mustEnv(name) {
  const v = clean(process.env[name]);
  if (!v) {
    const err = new Error(`Missing env var: ${name}`);
    err.code = 'MISSING_ENV';
    throw err;
  }
  return v;
}

async function authorizeB2Account() {
  const B2_KEY_ID = mustEnv('B2_KEY_ID');
  const B2_APP_KEY = mustEnv('B2_APP_KEY');

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
  const recommendedPartSize = Number(authJson.recommendedPartSize || 0);
  const absoluteMinimumPartSize = Number(authJson.absoluteMinimumPartSize || 0);

  if (!apiUrl || !downloadUrl || !authToken) {
    const err = new Error('Missing apiUrl/downloadUrl/token from B2 auth');
    err.code = 'B2_AUTH_MISSING_FIELDS';
    err.details = authJson;
    throw err;
  }

  return {
    apiUrl,
    downloadUrl,
    authToken,
    recommendedPartSize,
    absoluteMinimumPartSize,
  };
}

/**
 * Shared helper: authorize B2 + create a short-lived download authorization token.
 * Returns { downloadUrl, downloadAuthToken, expiresInSec }
 */
async function getB2DownloadAuth(prefix = 'videos/', expiresInSec = 60 * 60) {
  const B2_BUCKET_ID = mustEnv('B2_BUCKET_ID');

  const { apiUrl, downloadUrl, authToken } = await authorizeB2Account();

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

/* -------------------------------------------------------------------------- */
/* ✅ B2 upload URL helper                                                     */
/* -------------------------------------------------------------------------- */

async function getB2UploadUrl(apiUrl, authToken, bucketId) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_get_upload_url failed');
    err.code = 'B2_GET_UPLOAD_URL_FAILED';
    err.details = j;
    throw err;
  }

  if (!j.uploadUrl || !j.authorizationToken) {
    const err = new Error('b2_get_upload_url missing fields');
    err.code = 'B2_GET_UPLOAD_URL_MISSING_FIELDS';
    err.details = j;
    throw err;
  }

  return { uploadUrl: j.uploadUrl, uploadAuthToken: j.authorizationToken };
}

/* -------------------------------------------------------------------------- */
/* ✅ B2 large-file helpers                                                    */
/* -------------------------------------------------------------------------- */

async function startB2LargeFile(apiUrl, authToken, bucketId, fileName, contentType, fileInfo = {}) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_start_large_file`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      fileName,
      contentType,
      fileInfo,
    }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_start_large_file failed');
    err.code = 'B2_START_LARGE_FILE_FAILED';
    err.details = j;
    throw err;
  }

  if (!j.fileId || !j.fileName) {
    const err = new Error('b2_start_large_file missing fields');
    err.code = 'B2_START_LARGE_FILE_MISSING_FIELDS';
    err.details = j;
    throw err;
  }

  return j;
}

async function getB2UploadPartUrl(apiUrl, authToken, fileId) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_part_url`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_get_upload_part_url failed');
    err.code = 'B2_GET_UPLOAD_PART_URL_FAILED';
    err.details = j;
    throw err;
  }

  if (!j.uploadUrl || !j.authorizationToken) {
    const err = new Error('b2_get_upload_part_url missing fields');
    err.code = 'B2_GET_UPLOAD_PART_URL_MISSING_FIELDS';
    err.details = j;
    throw err;
  }

  return {
    uploadUrl: j.uploadUrl,
    uploadAuthToken: j.authorizationToken,
  };
}

async function finishB2LargeFile(apiUrl, authToken, fileId, partSha1Array) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_finish_large_file`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      partSha1Array,
    }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_finish_large_file failed');
    err.code = 'B2_FINISH_LARGE_FILE_FAILED';
    err.details = j;
    throw err;
  }

  return j;
}

async function listB2Parts(apiUrl, authToken, fileId, startPartNumber = 1, maxPartCount = 1000) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_list_parts`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      startPartNumber,
      maxPartCount,
    }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_list_parts failed');
    err.code = 'B2_LIST_PARTS_FAILED';
    err.details = j;
    throw err;
  }

  return j;
}

async function cancelB2LargeFile(apiUrl, authToken, fileId) {
  const r = await fetch(`${apiUrl}/b2api/v2/b2_cancel_large_file`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('b2_cancel_large_file failed');
    err.code = 'B2_CANCEL_LARGE_FILE_FAILED';
    err.details = j;
    throw err;
  }

  return j;
}

/* -------------------------------------------------------------------------- */
/* ✅ B2 delete helper                                                         */
/* -------------------------------------------------------------------------- */

async function deleteB2FileByName(apiUrl, authToken, bucketId, fileName) {
  const cleanName = (fileName || '').toString().trim();
  if (!cleanName) return { ok: true, skipped: true };

  const listRes = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      prefix: cleanName,
      maxFileCount: 10,
    }),
  });

  const listJson = await listRes.json().catch(() => ({}));
  if (!listRes.ok) {
    const err = new Error('b2_list_file_names failed');
    err.code = 'B2_LIST_FILE_NAMES_FAILED';
    err.details = listJson;
    throw err;
  }

  const files = Array.isArray(listJson.files) ? listJson.files : [];
  const exact = files.find((f) => (f?.fileName || '') === cleanName);

  // Missing file = already deleted / okay
  if (!exact) {
    return { ok: true, missing: true, fileName: cleanName };
  }

  const delRes = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId: exact.fileId,
      fileName: exact.fileName,
    }),
  });

  const delJson = await delRes.json().catch(() => ({}));
  if (!delRes.ok) {
    const err = new Error('b2_delete_file_version failed');
    err.code = 'B2_DELETE_FILE_VERSION_FAILED';
    err.details = delJson;
    throw err;
  }

  return {
    ok: true,
    fileId: exact.fileId,
    fileName: exact.fileName,
  };
}

/* -------------------------------------------------------------------------- */
/* ✅ NEW: start large video upload                                            */
/* -------------------------------------------------------------------------- */

exports.startLargeVideoUpload = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const originalFileName = clean(req.body?.originalFileName || '');
      const mimeType = clean(req.body?.mimeType || 'video/mp4') || 'video/mp4';

      if (!originalFileName) {
        return res.status(400).json({ error: 'Missing originalFileName' });
      }

      const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `videos/${uid}/${safeName}`;

      const B2_BUCKET_ID = mustEnv('B2_BUCKET_ID');
      const {
        apiUrl,
        authToken,
        recommendedPartSize,
        absoluteMinimumPartSize,
      } = await authorizeB2Account();

      const started = await startB2LargeFile(
        apiUrl,
        authToken,
        B2_BUCKET_ID,
        fileName,
        mimeType,
        {
          ownerUid: uid,
          originalFileName: safeName,
        },
      );

      return res.json({
        ok: true,
        fileId: started.fileId,
        fileName: started.fileName,
        recommendedPartSize,
        absoluteMinimumPartSize,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'startLargeVideoUpload failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW: get upload-part URL for large video                                 */
/* -------------------------------------------------------------------------- */

exports.getLargeVideoUploadPartUrl = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      await admin.auth().verifyIdToken(idToken);

      const fileId = clean(req.body?.fileId || '');
      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }

      const { apiUrl, authToken } = await authorizeB2Account();
      const out = await getB2UploadPartUrl(apiUrl, authToken, fileId);

      return res.json({
        ok: true,
        uploadUrl: out.uploadUrl,
        uploadAuthToken: out.uploadAuthToken,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'getLargeVideoUploadPartUrl failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW: finish large video upload                                           */
/* -------------------------------------------------------------------------- */

exports.finishLargeVideoUpload = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      await admin.auth().verifyIdToken(idToken);

      const fileId = clean(req.body?.fileId || '');
      const partSha1Array = Array.isArray(req.body?.partSha1Array)
        ? req.body.partSha1Array.map((x) => clean(x))
        : [];

      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }
      if (!partSha1Array.length) {
        return res.status(400).json({ error: 'Missing partSha1Array' });
      }

      const { apiUrl, authToken } = await authorizeB2Account();
      const out = await finishB2LargeFile(apiUrl, authToken, fileId, partSha1Array);

      return res.json({
        ok: true,
        fileId: out.fileId,
        fileName: out.fileName,
        contentLength: out.contentLength ?? null,
        contentSha1: out.contentSha1 ?? null,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'finishLargeVideoUpload failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW: list uploaded parts for recovery / resume                           */
/* -------------------------------------------------------------------------- */

exports.listLargeVideoParts = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      await admin.auth().verifyIdToken(idToken);

      const fileId = clean(req.body?.fileId || '');
      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }

      const { apiUrl, authToken } = await authorizeB2Account();
      const out = await listB2Parts(apiUrl, authToken, fileId);

      return res.json({
        ok: true,
        parts: Array.isArray(out.parts) ? out.parts : [],
        nextPartNumber: out.nextPartNumber ?? null,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'listLargeVideoParts failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW: cancel unfinished large upload                                      */
/* -------------------------------------------------------------------------- */

exports.cancelLargeVideoUpload = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      await admin.auth().verifyIdToken(idToken);

      const fileId = clean(req.body?.fileId || '');
      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }

      const { apiUrl, authToken } = await authorizeB2Account();
      const out = await cancelB2LargeFile(apiUrl, authToken, fileId);

      return res.json({
        ok: true,
        fileId: out.fileId ?? fileId,
        fileName: out.fileName ?? null,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'cancelLargeVideoUpload failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW ENDPOINT: Get signed VIEW url for a private athlete photo            */
/* -------------------------------------------------------------------------- */

exports.getAthletePhotoViewUrl = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const path = (req.query.path ?? '').toString().trim();
      if (!path.startsWith('videos/')) return res.status(400).json({ error: 'Invalid path' });

      // enforce: videos/<uid>/...
      const parts = path.split('/');
      const uidInPath = parts[1];
      if (!uidInPath || uidInPath !== uid) return res.status(403).json({ error: 'Forbidden' });

      const expiresInSec = 60 * 60; // 1 hour
      const { downloadAuthToken } = await getB2DownloadAuth('videos/', expiresInSec);

      const photoUrl = buildCdnUrl(path, downloadAuthToken);
      return res.json({ photoUrl, expiresInSec });
    } catch (e) {
      return res.status(500).json({
        error: 'getAthletePhotoViewUrl failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ UPDATED: Athlete upload-url endpoint returns photoKey too                */
/* -------------------------------------------------------------------------- */

exports.getAthletePhotoUploadUrl = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const athleteId = (req.query.athleteId ?? '').toString().trim();
      if (!athleteId) return res.status(400).json({ error: 'Missing athleteId' });

      const B2_BUCKET_ID = mustEnv('B2_BUCKET_ID');

      // Authorize B2 (account auth)
      const { apiUrl, authToken } = await authorizeB2Account();

      // File key (keep under videos/ so prefix auth works)
      const safeAthleteId = athleteId.replace(/[^a-zA-Z0-9_-]/g, '');
      const ts = Date.now();
      const fileName = `videos/${uid}/athletes/${safeAthleteId}/profile_${ts}.jpg`;

      // Upload URL + token (phone uploads directly)
      const { uploadUrl, uploadAuthToken } = await getB2UploadUrl(apiUrl, authToken, B2_BUCKET_ID);

      // tokened url (legacy convenience; don’t rely on it long-term)
      const { downloadAuthToken, expiresInSec } = await getB2DownloadAuth('videos/', 60 * 60);
      const photoUrl = buildCdnUrl(fileName, downloadAuthToken);

      return res.json({
        uploadUrl,
        uploadAuthToken,
        fileName,
        photoKey: fileName, // ✅ stable forever
        photoUrl,
        expiresInSec,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'getAthletePhotoUploadUrl failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ✅ NEW: delete one cloud video owned by the caller                          */
/* -------------------------------------------------------------------------- */

exports.deleteVideo = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST' });
      }

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const videoId = (req.body?.videoId ?? '').toString().trim();
      if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
      }

      const vidRef = admin.firestore().doc(`videos/${videoId}`);
      const vidSnap = await vidRef.get();

      if (!vidSnap.exists) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const v = vidSnap.data() || {};
      const ownerUid = (v.ownerUid || '').toString().trim();
      if (!ownerUid || ownerUid !== uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const B2_BUCKET_ID = mustEnv('B2_BUCKET_ID');
      const { apiUrl, authToken } = await authorizeB2Account();

      const b2VideoKey = (v.b2VideoKey || '').toString().trim();
      const b2SidecarKey = (v.b2SidecarKey || '').toString().trim();
      const shareId = (v.shareId || '').toString().trim();

      const deleteResults = {
        video: null,
        sidecar: null,
      };

      if (b2VideoKey) {
        deleteResults.video = await deleteB2FileByName(apiUrl, authToken, B2_BUCKET_ID, b2VideoKey);
      }

      if (b2SidecarKey) {
        deleteResults.sidecar = await deleteB2FileByName(apiUrl, authToken, B2_BUCKET_ID, b2SidecarKey);
      }

      await vidRef.delete();

      if (shareId) {
        await admin.firestore().doc(`shareIndex/${shareId}`).delete().catch(() => {});
      }

      return res.json({
        ok: true,
        videoId,
        shareId: shareId || null,
        deleteResults,
      });
    } catch (e) {
      return res.status(500).json({
        error: 'deleteVideo failed',
        details: String(e?.message || e),
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ---------------------------- EXISTING FUNCTIONS --------------------------- */
/* -------------------------------------------------------------------------- */

exports.syncShareIndex = onDocumentWritten('videos/{videoId}', async (event) => {
  try {
    const after = event.data?.after;
    if (!after || !after.exists) return;

    const v = after.data() || {};
    const shareId = (v.shareId || '').toString().trim();
    if (!shareId) return;

    const videoId = event.params.videoId;

    await admin.firestore().doc(`shareIndex/${shareId}`).set(
      {
        videoId,
        isPublic: v.isPublic === true,
        ownerUid: v.ownerUid || null,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error('[syncShareIndex] failed:', e);
  }
});

exports.getPlaybackUrls = onRequest((req, res) => {
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
      const b2VideoKey = v.b2VideoKey;
      const b2SidecarKey = v.b2SidecarKey;

      if (!b2VideoKey) return res.status(500).json({ error: 'Video missing b2VideoKey' });
      if (!b2SidecarKey) return res.status(500).json({ error: 'Video missing b2SidecarKey' });

      if (v.shareId && v.shareId !== shareId) {
        return res.status(403).json({ error: 'shareId mismatch' });
      }

      const { downloadAuthToken, expiresInSec } = await getB2DownloadAuth('videos/', 60 * 60);

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

exports.getSidecar = onRequest((req, res) => {
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

      const B2_BUCKET_NAME = mustEnv('B2_BUCKET_NAME');

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

exports.getB2DownloadAuthForPath = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

      const authHeader = (req.headers.authorization || '').toString();
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });

      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const path = (req.query.path ?? '').toString().trim();
      if (!path.startsWith('videos/')) return res.status(400).json({ error: 'Invalid path' });

      const parts = path.split('/');
      const uidInPath = parts[1];
      if (!uidInPath || uidInPath !== uid) return res.status(403).json({ error: 'Forbidden' });

      const B2_BUCKET_NAME = mustEnv('B2_BUCKET_NAME');

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
        code: e?.code,
        extra: e?.details,
      });
    }
  });
});