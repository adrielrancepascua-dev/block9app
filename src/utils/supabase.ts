import { createClient } from "@supabase/supabase-js";
import { linkedSupabaseAnonKey, linkedSupabaseUrl } from "@/utils/linked-supabase";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || linkedSupabaseUrl;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || linkedSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
