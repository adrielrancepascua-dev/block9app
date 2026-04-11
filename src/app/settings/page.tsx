"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Save, Eye } from "lucide-react";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewImageValid, setIsPreviewImageValid] = useState(true);

  // Initialize form with current profile data
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (profile) {
      setName(profile.name || "");
      setCustomBgUrl(profile.custom_bg_url || "");
    }
  }, [profile, loading, user, router]);

  // Handle image load for preview validation
  const handleImageLoad = () => {
    setIsPreviewImageValid(true);
  };

  const handleImageError = () => {
    setIsPreviewImageValid(false);
    toast.error("Background image URL is not valid or unreachable");
  };

  // Save settings to Supabase
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
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          custom_bg_url: customBgUrl.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Settings saved successfully!");
      setShowPreview(false);
    } catch (err: any) {
      console.error("Error saving settings:", err.message);
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  return (
    <ProfileLayout customBgUrl={showPreview && isPreviewImageValid ? customBgUrl : undefined}>
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 drop-shadow-md dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            Update your profile information and customize your experience.
          </p>
        </div>

        {/* Settings Form */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80">
          <form className="space-y-6">
            {/* Name Input */}
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

            {/* Custom Background URL Input */}
            <div>
              <label htmlFor="bgUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Custom Background Image URL
              </label>
              <input
                id="bgUrl"
                type="url"
                value={customBgUrl}
                onChange={(e) => setCustomBgUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Enter a full image URL (HTTPS). Leave blank to use default background.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                disabled={isSaving || !customBgUrl.trim()}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide Preview" : "Apply Preview"}
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

        {/* Preview Section */}
        {showPreview && customBgUrl.trim() && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Preview
            </h2>
            <div
              className="relative h-64 rounded-2xl border border-slate-300 shadow-lg dark:border-slate-600"
              style={{
                backgroundImage: `url('${customBgUrl}')`,
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
                    with glassmorphic blur effect applied
                  </p>
                </div>
              </div>
            </div>
            {!isPreviewImageValid && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700 dark:border-orange-900/30 dark:bg-orange-900/20 dark:text-orange-300">
                Image failed to load. Check the URL and try again.
              </div>
            )}
            <img
              src={customBgUrl}
              alt="preview"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="hidden"
            />
          </div>
        )}

        {/* Info Card */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>💡 Tip:</strong> Your custom background image will be displayed with a glassmorphic blur effect to ensure text remains readable on all pages.
          </p>
        </div>
      </div>
    </ProfileLayout>
  );
}
