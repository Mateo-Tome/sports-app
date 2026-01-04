"use client";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { auth } from "../../lib/firebase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // app/page.tsx listens with onAuthStateChanged and will flip you in automatically
    } catch (e: any) {
      setError(e?.message ?? "Create account failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="text-2xl font-extrabold">QuickClip Web</div>
        <div className="mt-1 text-white/60">Create account</div>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Password (min 6 characters)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="w-full rounded-xl bg-white text-black font-bold py-3 disabled:opacity-60"
            onClick={onCreate}
            disabled={busy || !email || password.length < 6}
          >
            {busy ? "Creating..." : "Create Account"}
          </button>

          {error ? (
            <div className="text-sm text-red-400 wrap-break-word">{error}</div>
          ) : (
            <div className="text-xs text-white/40">
              After creating, you’ll be signed in automatically.
            </div>
          )}

          <a
            href="/"
            className="block text-center text-sm text-white/70 hover:text-white underline underline-offset-4"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
