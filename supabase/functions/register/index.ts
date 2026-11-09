import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const DEFAULT_SECTION_SECRET_CODE = "BLOCK9_2026";

const json = (body: Record<string, string>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sectionSecretCode = Deno.env.get("SECTION_SECRET_CODE") || DEFAULT_SECTION_SECRET_CODE;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ message: "Registration service is missing its server credentials." }, 500);
  }

  let payload: { fullName?: string; email?: string; password?: string; secretCode?: string };

  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }

  const fullName = payload.fullName?.trim() || "";
  const email = payload.email?.trim().toLowerCase() || "";
  const password = payload.password || "";
  const secretCode = payload.secretCode?.trim() || "";

  if (!fullName) return json({ message: "Full name is required." }, 400);
  if (!email || !isValidEmail(email)) return json({ message: "A valid email is required." }, 400);
  if (!password || password.length < 6) return json({ message: "Password must be at least 6 characters." }, 400);
  if (!secretCode) return json({ message: "Section secret code is required." }, 400);
  if (secretCode.toUpperCase() !== sectionSecretCode.toUpperCase()) {
    return json({ message: "Invalid section secret code." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: existingProfiles } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true });

  const role = (existingProfiles ?? 0) === 0 ? "admin" : "student";

  const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: fullName },
  });

  if (createUserError) {
    const message = createUserError.message || "Failed to create account.";
    const isConflict = /already registered|already exists|duplicate/i.test(message);
    return json(
      { message: isConflict ? "Email already registered. Please log in instead." : `Sign up failed: ${message}` },
      isConflict ? 409 : 400
    );
  }

  const userId = userData.user?.id;
  if (!userId) {
    return json({ message: "User was created without an id. Please try again." }, 500);
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      name: fullName,
      role,
      custom_bg_url: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    return json({ message: `Account created, but profile setup failed: ${profileError.message}` }, 500);
  }

  return json({ message: "Account created successfully." }, 201);
});
