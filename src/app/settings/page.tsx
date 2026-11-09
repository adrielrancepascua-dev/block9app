"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import { useTheme, type ThemeChoice } from "@/context/ThemeContext";
import { CLASS_PHOTO } from "@/utils/brand";
import ProfileLayout from "@/components/ProfileLayout";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { ImageIcon, Save, Upload, UserRound, X } from "lucide-react";
import AppLoading from "@/components/AppLoading";

export default function SettingsPage() {
  const { user, profile, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }

    if (profile) {
      setName(profile.name || "");
      setCustomBgUrl(profile.custom_bg_url || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile, loading, user, router]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      if (backgroundPreviewUrl) {
        URL.revokeObjectURL(backgroundPreviewUrl);
      }
    };
  }, [avatarPreviewUrl, backgroundPreviewUrl]);

  const releasePreviewUrl = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const uploadMediaFile = async (file: File, folder: "avatars" | "backgrounds") => {
    if (!user) throw new Error("User not authenticated");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const randomPart = Math.random().toString(36).slice(2, 9);
    const path = `${user.id}/${folder}/${Date.now()}-${randomPart}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const onAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    releasePreviewUrl(avatarPreviewUrl);
    const preview = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(preview);
    setRemoveAvatar(false);
  };

  const onBackgroundFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    releasePreviewUrl(backgroundPreviewUrl);
    const preview = URL.createObjectURL(file);
    setBackgroundFile(file);
    setBackgroundPreviewUrl(preview);
  };

  const clearAvatarSelection = () => {
    setAvatarFile(null);
    releasePreviewUrl(avatarPreviewUrl);
    setAvatarPreviewUrl(null);
  };

  const clearBackgroundSelection = () => {
    setBackgroundFile(null);
    releasePreviewUrl(backgroundPreviewUrl);
    setBackgroundPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setIsSaving(true);

    try {
      let nextAvatarUrl = removeAvatar ? null : avatarUrl || null;
      let nextBackgroundUrl = customBgUrl.trim() || null;

      if (avatarFile) {
        nextAvatarUrl = await uploadMediaFile(avatarFile, "avatars");
      }

      if (backgroundFile) {
        nextBackgroundUrl = await uploadMediaFile(backgroundFile, "backgrounds");
      }

      const baseUpdates = {
        name: name.trim(),
        custom_bg_url: nextBackgroundUrl,
      };

      let avatarColumnMissing = false;

      const { error: primaryError } = await supabase
        .from("profiles")
        .update({
          ...baseUpdates,
          avatar_url: nextAvatarUrl,
        })
        .eq("user_id", user.id);

      if (primaryError?.code === "42703") {
        avatarColumnMissing = true;
        const { error: fallbackError } = await supabase
          .from("profiles")
          .update(baseUpdates)
          .eq("user_id", user.id);

        if (fallbackError) {
          throw fallbackError;
        }
      } else if (primaryError) {
        throw primaryError;
      }

      setAvatarUrl(nextAvatarUrl || "");
      setCustomBgUrl(nextBackgroundUrl || "");
      setRemoveAvatar(false);
      clearAvatarSelection();
      clearBackgroundSelection();
      setShowPreview(false);

      if (avatarColumnMissing) {
        toast.success("Settings saved. Profile photo is temporarily unavailable.");
      } else {
        toast.success("Settings saved successfully!");
      }
    } catch (err: any) {
      console.error("Error saving settings:", err.message);
      if (/bucket|storage|not found/i.test(err?.message || "")) {
        toast.error("Media upload is temporarily unavailable. Please try again later.");
      } else {
        toast.error(`Failed to save settings: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resolvedAvatarPreview = removeAvatar
    ? ""
    : avatarPreviewUrl || avatarUrl || "";

  const resolvedBackgroundPreview = backgroundPreviewUrl || customBgUrl.trim();
  const layoutPreviewBackground = showPreview && resolvedBackgroundPreview ? resolvedBackgroundPreview : undefined;

  if (loading) {
    return (
      <AppLoading />
    );
  }

  const backgroundPreview = backgroundPreviewUrl || (customBgUrl.trim().startsWith("http") ? customBgUrl : CLASS_PHOTO);
  const themeOptions: { id: ThemeChoice; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "Match phone" },
  ];

  return (
    <ProfileLayout customBgUrl={layoutPreviewBackground}>
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="mb-2">
          <h1 className="text-[1.85rem] font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-[var(--muted)]">
            Your name, your photo, and how Block 9 looks.
          </p>
        </header>

        <section className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Appearance</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                  theme === option.id
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--line)] bg-[var(--quiet)] text-[var(--ink)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <label htmlFor="name" className="block text-sm font-semibold text-[var(--ink)]">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The name people see"
            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--quiet)]">
              {resolvedAvatarPreview ? (
                <img src={resolvedAvatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-8 w-8 text-[var(--muted)]" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--quiet)] px-4 text-sm font-semibold text-[var(--ink)]">
                <Upload className="h-4 w-4" />
                Photo
                <input type="file" accept="image/*" onChange={onAvatarFileChange} className="hidden" disabled={isSaving} />
              </label>
              <button
                type="button"
                onClick={() => {
                  setRemoveAvatar(true);
                  clearAvatarSelection();
                }}
                disabled={isSaving || (!resolvedAvatarPreview && !avatarFile)}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Background</h2>
          <div
            className="mt-4 h-36 rounded-[1.2rem] border border-[var(--line)] bg-cover bg-center"
            style={{ backgroundImage: `url('${backgroundPreview}')` }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--quiet)] px-4 text-sm font-semibold text-[var(--ink)]">
              <ImageIcon className="h-4 w-4" />
              Upload a photo
              <input type="file" accept="image/*" onChange={onBackgroundFileChange} className="hidden" disabled={isSaving} />
            </label>
            <button
              type="button"
              onClick={() => {
                clearBackgroundSelection();
                setCustomBgUrl("");
              }}
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink)]"
            >
              Class photo
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)]"
        >
          Sign out
        </button>
      </div>
    </ProfileLayout>
  );
}
