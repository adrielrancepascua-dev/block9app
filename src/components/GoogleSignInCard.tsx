"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { AuthScreen, AuthSwitch, GoogleButton } from "@/components/auth-ui";

export default function GoogleSignInCard({
  subtitle,
  buttonLabel,
  prompt,
  href,
  linkLabel,
  nextPath = "/",
  autoStart = false,
}: {
  subtitle: string;
  buttonLabel: string;
  prompt: string;
  href: string;
  linkLabel: string;
  nextPath?: string;
  autoStart?: boolean;
}) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(autoStart);
  const startedRef = useRef(false);

  const start = async () => {
    setError("");
    setPending(true);

    try {
      await signInWithGoogle(nextPath);
    } catch (err: unknown) {
      setPending(false);
      const message = err instanceof Error ? err.message : "Could not open Google.";
      if (/provider is not enabled|unsupported provider/i.test(message)) {
        setError("Google sign-in is not turned on for this project yet.");
        return;
      }
      if (message === "Failed to fetch") {
        setError("Could not reach Block 9. Check your connection and try again.");
        return;
      }
      setError(message);
    }
  };

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [autoStart]);

  return (
    <AuthScreen subtitle={subtitle}>
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200/40 bg-rose-500/20 px-3 py-2.5 text-sm text-rose-50">
          {error}
        </div>
      ) : null}
      <GoogleButton label={buttonLabel} pending={pending} onClick={start} />
      <AuthSwitch prompt={prompt} href={href} label={linkLabel} />
    </AuthScreen>
  );
}
