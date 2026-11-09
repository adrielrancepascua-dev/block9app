import { createClient } from "@supabase/supabase-js";
import { resolveSupabasePublic } from "@/utils/linked-supabase";

const { url, anonKey } = resolveSupabasePublic();

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
