// web/app/api/b2-sidecar/route.ts
import { NextResponse } from 'next/server';

function clean(v: any) {
  return (v ?? '')
    .toString()
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1');
}

function requireEnv(name: string) {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function buildB2FileUrl(downloadUrl: string, bucketName: string, fileName: string, authToken: string) {
  const safeName = fileName
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${safeName}?Authorization=${encodeURIComponent(
    authToken
  )}`;
}

async function getB2DownloadAuthForExactFile(fileName: string, expiresInSec = 60 * 30) {
  const B2_KEY_ID = requireEnv('B2_KEY_ID');
  const B2_APP_KEY = requireEnv('B2_APP_KEY');
  const B2_BUCKET_ID = requireEnv('B2_BUCKET_ID');

  const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');

  // 1) authorize account
  const authRes = await fetch('https://api.backblazeb2.com/b2api/v1/b2_authorize_account', {
    method: 'GET',
    headers: { Authorization: `Basic ${basicAuth}` },
    cache: 'no-store',
  });

  const authJson = await authRes.json().catch(() => ({}));
  if (!authRes.ok) {
    throw new Error(`b2_authorize_account failed: ${JSON.stringify(authJson)}`);
  }

  const apiUrl = authJson.apiUrl;
  const downloadUrl = authJson.downloadUrl;
  const authToken = authJson.authorizationToken;

  if (!apiUrl || !downloadUrl || !authToken) {
    throw new Error(`B2 auth missing fields: ${JSON.stringify(authJson)}`);
  }

  // 2) short-lived download authorization scoped to this exact file
  const daRes = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: fileName, // exact
      validDurationInSeconds: Math.min(expiresInSec, 7 * 24 * 60 * 60),
    }),
    cache: 'no-store',
  });

  const daJson = await daRes.json().catch(() => ({}));
  if (!daRes.ok) {
    throw new Error(`b2_get_download_authorization failed: ${JSON.stringify(daJson)}`);
  }

  const downloadAuthToken = daJson.authorizationToken;
  if (!downloadAuthToken) {
    throw new Error(`Missing download authorizationToken: ${JSON.stringify(daJson)}`);
  }

  return { downloadUrl, downloadAuthToken };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = (searchParams.get('fileName') ?? '').toString().trim();

    if (!fileName) {
      return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });
    }
    if (!fileName.endsWith('.json')) {
      return NextResponse.json({ error: 'fileName must end with .json' }, { status: 400 });
    }

    const B2_BUCKET_NAME = requireEnv('B2_BUCKET_NAME');

    const { downloadUrl, downloadAuthToken } = await getB2DownloadAuthForExactFile(fileName, 60 * 30);
    const sidecarUrl = buildB2FileUrl(downloadUrl, B2_BUCKET_NAME, fileName, downloadAuthToken);

    const r = await fetch(sidecarUrl, { method: 'GET', cache: 'no-store' });
    const text = await r.text();

    return new NextResponse(text, {
      status: r.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'b2-sidecar failed', details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
