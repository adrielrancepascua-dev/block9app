"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { AuthScreen, GoogleButton } from "@/components/auth-ui";

const inputClass =
  "w-full rounded-2xl border border-white/35 bg-white/15 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/60 focus:border-white focus:ring-2 focus:ring-white/30";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"email" | "google" | "signup" | null>(null);

  const startGoogle = async (nextPath: string, mode: "google" | "signup") => {
    setError("");
    setPending(mode);
    try {
      await signInWithGoogle(nextPath);
    } catch (err: unknown) {
      setPending(null);
      setError(readableAuthError(err));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending("email");
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      setPending(null);
      setError(readableAuthError(err));
    }
  };

  return (
    <AuthScreen subtitle="Sign in with your email. New accounts start with Google.">
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200/40 bg-rose-500/20 px-3 py-2.5 text-sm text-rose-50">
          {error}
        </div>
      ) : null}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-white">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="you@gmail.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-white">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            placeholder="Your password"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d4f91] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2460ad] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {pending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending === "email" ? "Signing in" : "Sign in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs font-medium tracking-wide text-white/55">
        <span className="h-px flex-1 bg-white/25" />
        or
        <span className="h-px flex-1 bg-white/25" />
      </div>

      <GoogleButton
        label="Continue with Google"
        pending={pending === "google"}
        onClick={() => void startGoogle("/", "google")}
      />

      <p className="mt-6 text-center text-sm text-white/80">
        New here?{" "}
        <button
          type="button"
          onClick={() => void startGoogle("/welcome", "signup")}
          disabled={pending !== null}
          className="font-semibold text-white underline decoration-white/40 underline-offset-4 disabled:opacity-70"
        >
          {pending === "signup" ? "Opening Google" : "Create an account"}
        </button>
      </p>
    </AuthScreen>
  );
}

function readableAuthError(err: unknown) {
  const message = err instanceof Error ? err.message : "Could not sign in.";
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return "Google sign-in is not turned on for this project yet.";
  }
  if (message === "Failed to fetch") {
    return "Could not reach Block 9. Check your connection and try again.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "That email and password do not match.";
  }
  return message;
}
