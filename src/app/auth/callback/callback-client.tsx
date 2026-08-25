"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export function AuthCallbackClient() {
  const params = useSearchParams();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  // An authorization code is single-use. Exchange exactly once per code.
  const exchanged = useRef<string | null>(null);

  const code = params.get("code");
  const oauthError = params.get("error");
  const errorDescription = params.get("error_description");

  const paramError = oauthError
    ? errorDescription || oauthError
    : code
      ? null
      : "Missing authorization code";

  useEffect(() => {
    if (!code || oauthError) return;
    if (exchanged.current === code) return;
    exchanged.current = code;

    (async () => {
      try {
        const res = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setExchangeError(body?.error || "Sign-in failed");
          return;
        }
        window.location.assign("/");
      } catch {
        setExchangeError("Sign-in failed — could not reach the server.");
      }
    })();
  }, [code, oauthError]);

  const error = paramError ?? exchangeError;

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-medium text-[var(--cc-ink)]">Sign-in failed</h1>
        <p className="text-sm text-[var(--cc-muted)]">{error}</p>
        <a
          href="/api/auth/start"
          className="rounded-md bg-[var(--cc-ink)] px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[var(--cc-muted)]">
      Completing sign-in…
    </div>
  );
}
