"use client";

import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ If already logged in, go home
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/");
    });
    return () => unsub();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white grid place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-bold">QuickClip Web</h1>
        <p className="mt-2 text-white/60 text-sm">Sign in to view your library.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs text-white/50">Email</label>
            <input
              className="mt-1 w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/25"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="text-xs text-white/50">Password</label>
            <input
              className="mt-1 w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/25"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-xs text-white/40">
          Use the same Firebase Auth email/password you used in Chrome.
        </p>
      </div>
    </main>
  );
}
