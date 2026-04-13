"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Eye, ImageIcon, Save, Upload, UserRound, X } from "lucide-react";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  return (
    <ProfileLayout customBgUrl={layoutPreviewBackground}>
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 drop-shadow-md dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            Update your profile information and customize your experience.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80">
          <form className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                This is how your name appears across the app.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Profile Photo</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800">
                  {resolvedAvatarPreview ? (
                    <img src={resolvedAvatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-8 w-8 text-slate-500 dark:text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Upload className="h-4 w-4" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onAvatarFileChange}
                      className="hidden"
                      disabled={isSaving}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setRemoveAvatar(true);
                      clearAvatarSelection();
                    }}
                    disabled={isSaving || (!resolvedAvatarPreview && !avatarFile)}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload from your device. JPG, PNG, WEBP, and GIF are supported.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Background Image</p>

              <div>
                <label htmlFor="bgUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Background URL
                </label>
                <input
                  id="bgUrl"
                  type="url"
                  value={customBgUrl}
                  onChange={(e) => setCustomBgUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  <ImageIcon className="h-4 w-4" />
                  Upload From Device
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onBackgroundFileChange}
                    className="hidden"
                    disabled={isSaving}
                  />
                </label>

                <button
                  type="button"
                  onClick={clearBackgroundSelection}
                  disabled={!backgroundFile || isSaving}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  Clear Upload
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                You can use either a URL or an uploaded image. Uploaded file takes priority when saving.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                disabled={isSaving || !resolvedBackgroundPreview}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide Live Preview" : "Show Live Preview"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 dark:hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>

        {showPreview && resolvedBackgroundPreview && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Preview
            </h2>
            <div
              className="relative h-64 rounded-2xl border border-slate-300 shadow-lg dark:border-slate-600"
              style={{
                backgroundImage: `url('${resolvedBackgroundPreview}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Blur overlay */}
              <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-md"></div>

              {/* Content overlay for context */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl p-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-white drop-shadow-md">
                    This is how your background will appear
                  </p>
                  <p className="text-xs text-white/80 drop-shadow-md">
                    with the app glassmorphism overlay
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </ProfileLayout>
  );
}
