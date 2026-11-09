"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { AuthScreen } from "@/components/auth-ui";
import AppLoading from "@/components/AppLoading";

const inputClass =
  "w-full rounded-2xl border border-white/35 bg-white/15 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/60 focus:border-white focus:ring-2 focus:ring-white/30";

export default function WelcomePage() {
  const { user, profile, loading, profileReady, finishAccount } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!loading && profileReady && !user) {
      router.replace("/login");
    }
  }, [loading, profileReady, user, router]);

  useEffect(() => {
    if (seeded || !user || !profileReady) return;
    const gmail = user.email ?? "";
    const localPart = gmail.split("@")[0];
    if (profile?.name && profile.name !== localPart) {
      setName(profile.name);
    }
    setEmail(gmail);
    setSeeded(true);
  }, [profile?.name, profileReady, seeded, user]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter the name you want people to see.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email you want to sign in with.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for the password.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await finishAccount({ name: trimmed, email, password });
      router.replace("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not finish your account.";
      setError(message);
      setSaving(false);
    }
  };

  if (loading || !profileReady || !user) {
    return <AppLoading label="Getting your account" />;
  }

  return (
    <AuthScreen subtitle="You are in with Google. Set the name, email, and password you will use next time.">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="mb-2 block text-sm font-medium text-white">
            Your name
          </label>
          <input
            id="displayName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            autoComplete="nickname"
            maxLength={80}
            placeholder="Any name you like"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="accountEmail" className="mb-2 block text-sm font-medium text-white">
            Email
          </label>
          <input
            id="accountEmail"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            autoComplete="email"
            placeholder="you@gmail.com"
            className={inputClass}
          />
          <p className="mt-2 text-xs leading-relaxed text-white/65">
            Filled in from the Gmail you just used. This is the email for next time.
          </p>
        </div>
        <div>
          <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-white">
            Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className={inputClass}
          />
        </div>
        {error ? <p className="text-sm text-rose-100">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d4f91] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2460ad] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving" : "Save and continue"}
        </button>
      </form>
    </AuthScreen>
  );
}
