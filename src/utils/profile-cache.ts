import type { Profile } from "@/context/SupabaseAuthContext";

const STORAGE_KEY = "block9-profile";

export function readCachedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed?.user_id || !parsed.name?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedProfile(profile: Profile | null) {
  if (typeof window === "undefined") return;
  if (!profile?.user_id || !profile.name?.trim()) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user_id: profile.user_id,
        name: profile.name,
        role: profile.role,
        custom_bg_url: profile.custom_bg_url ?? null,
        avatar_url: profile.avatar_url ?? null,
        name_confirmed: profile.name_confirmed,
        created_at: profile.created_at,
      })
    );
  }
  window.dispatchEvent(new Event("block9-profile"));
}
