"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { AuthScreen } from "@/components/auth-ui";
import AppLoading from "@/components/AppLoading";

export default function WelcomePage() {
  const { user, profile, loading, profileReady, updateDisplayName } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!loading && profileReady && !user) {
      router.replace("/register");
    }
  }, [loading, profileReady, user, router]);

  useEffect(() => {
    if (seeded || !profile?.name) return;
    setName(profile.name);
    setSeeded(true);
  }, [profile?.name, seeded]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter the name you want people to see.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateDisplayName(trimmed);
      router.replace("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save that name.";
      setError(message);
      setSaving(false);
    }
  };

  if (loading || !profileReady || !user) {
    return <AppLoading label="Getting your account" />;
  }

  return (
    <AuthScreen subtitle="Pick the name people will see on the schedule, wall, and chat. It can be anything.">
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
            className="w-full rounded-2xl border border-white/35 bg-white/15 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/60 focus:border-white focus:ring-2 focus:ring-white/30"
          />
          {error ? <p className="mt-2 text-sm text-rose-100">{error}</p> : null}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d4f91] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2460ad] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving" : "Use this name"}
        </button>
      </form>
    </AuthScreen>
  );
}
