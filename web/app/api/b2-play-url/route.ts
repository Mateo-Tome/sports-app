import { NextResponse } from "next/server";

type B2AuthorizeResponse = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
};

type B2GetDownloadAuthResponse = {
  authorizationToken: string;
};

type B2ListFileNamesResponse = {
  files?: Array<{ fileName: string }>;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName"); // e.g. videos/<uid>/<shareId>.mp4
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }

    const keyId = process.env.B2_KEY_ID;
    const appKey = process.env.B2_APP_KEY;
    const bucketId = process.env.B2_BUCKET_ID;
    const bucketName = process.env.B2_BUCKET_NAME;

    if (!keyId || !appKey || !bucketId || !bucketName) {
      return NextResponse.json(
        { error: "Missing env vars: B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME" },
        { status: 500 }
      );
    }

    // 1) Authorize
    const basic = Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${basic}` },
      cache: "no-store",
    });

    if (!authRes.ok) {
      const detail = await authRes.text();
      return NextResponse.json({ error: "B2 authorize failed", detail }, { status: 500 });
    }

    const auth = (await authRes.json()) as B2AuthorizeResponse;

    // 2) Verify the file exists BEFORE returning a URL (prevents useless NotSupportedError later)
    const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        prefix: fileName,
        maxFileCount: 1,
      }),
      cache: "no-store",
    });

    if (!listRes.ok) {
      const detail = await listRes.text();
      return NextResponse.json({ error: "b2_list_file_names failed", detail }, { status: 500 });
    }

    const list = (await listRes.json()) as B2ListFileNamesResponse;
    const exists = (list.files ?? []).some((f) => f.fileName === fileName);

    if (!exists) {
      return NextResponse.json(
        {
          error: "missing_file",
          detail: `Backblaze does not have this file: ${fileName}`,
        },
        { status: 404 }
      );
    }

    // 3) Get a download auth token scoped to THIS file
    const dlAuthRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        fileNamePrefix: fileName,
        validDurationInSeconds: 60 * 10, // 10 min
      }),
      cache: "no-store",
    });

    if (!dlAuthRes.ok) {
      const detail = await dlAuthRes.text();
      return NextResponse.json(
        { error: "b2_get_download_authorization failed", detail },
        { status: 500 }
      );
    }

    const dl = (await dlAuthRes.json()) as B2GetDownloadAuthResponse;

    // 4) Build playable URL
    const safeFileName = encodeURIComponent(fileName).replace(/%2F/g, "/");
    const url = `${auth.downloadUrl}/file/${bucketName}/${safeFileName}?Authorization=${encodeURIComponent(
      dl.authorizationToken
    )}`;

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
