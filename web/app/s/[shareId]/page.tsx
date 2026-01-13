// web/app/s/[shareId]/page.tsx
import WebPlayback from "@/components/web/WebPlayback";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shareId: string }>;
};

export default async function SharePage({ params }: Props) {
  const { shareId } = await params;

  const endpoint = process.env.NEXT_PUBLIC_GET_PLAYBACK_URLS_ENDPOINT;
  if (!endpoint) {
    return (
      <div style={{ padding: 24, color: "white", background: "black", minHeight: "100vh" }}>
        Missing NEXT_PUBLIC_GET_PLAYBACK_URLS_ENDPOINT
      </div>
    );
  }

  const res = await fetch(`${endpoint}?shareId=${encodeURIComponent(shareId)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return (
      <div style={{ padding: 24, color: "white", background: "black", minHeight: "100vh" }}>
        Couldn’t load share. ({res.status})
        <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
      </div>
    );
  }

  const data = await res.json();

  return (
    <div style={{ background: "black", minHeight: "100vh" }}>
      <WebPlayback
        videoUrl={data.videoUrl ?? null}
        sidecarUrl={data.sidecarUrl ?? null}
        doc={data.meta ?? null}
      />
    </div>
  );
}
