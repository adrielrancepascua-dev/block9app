// Linked Supabase project (BLOCK9). Public URL and anon key are safe in the client.
// The service role key stays in host env only and is never committed.
export const linkedSupabaseUrl = "https://hellbzfjmfkrssdsdmrr.supabase.co";
export const linkedSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlbGxiemZqbWZrcnNzZHNkbXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMTM1OTEsImV4cCI6MjEwOTc4OTU5MX0.HFwRmzoehO8CzzaIbB6-kfPnChBX_vvPu5z2ANmU9C0";
export const linkedSupabaseRef = "hellbzfjmfkrssdsdmrr";

// Vercel still has the retired project in NEXT_PUBLIC_SUPABASE_URL. Ignore any
// public env that does not point at this linked project.
export function resolveSupabasePublic() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const envIsThisProject = envUrl.includes(linkedSupabaseRef);

  return {
    url: envIsThisProject ? envUrl : linkedSupabaseUrl,
    anonKey: envIsThisProject && envKey ? envKey : linkedSupabaseAnonKey,
  };
}
