import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface RegisterPayload {
  fullName?: string;
  email?: string;
  password?: string;
  secretCode?: string;
}

const DEFAULT_SECTION_SECRET_CODE = "BLOCK9_2026";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sectionSecretCode = process.env.SECTION_SECRET_CODE || DEFAULT_SECTION_SECRET_CODE;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        message:
          "Registration is not configured on the server. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  let payload: RegisterPayload;

  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim() || "";
  const email = payload.email?.trim().toLowerCase() || "";
  const password = payload.password || "";
  const secretCode = payload.secretCode?.trim() || "";

  if (!fullName) {
    return NextResponse.json({ message: "Full name is required." }, { status: 400 });
  }

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: "A valid email is required." }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
  }

  if (!secretCode) {
    return NextResponse.json({ message: "Section secret code is required." }, { status: 400 });
  }

  if (secretCode !== sectionSecretCode) {
    return NextResponse.json({ message: "Invalid section secret code." }, { status: 403 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: fullName },
  });

  if (createUserError) {
    const message = createUserError.message || "Failed to create account.";
    const isConflict = /already registered|already exists|duplicate/i.test(message);
    return NextResponse.json(
      {
        message: isConflict ? "Email already registered. Please log in instead." : `Sign up failed: ${message}`,
      },
      { status: isConflict ? 409 : 400 }
    );
  }

  const userId = userData.user?.id;

  if (!userId) {
    return NextResponse.json({ message: "User was created without an id. Please try again." }, { status: 500 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      user_id: userId,
      name: fullName,
      role: "student",
      custom_bg_url: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    return NextResponse.json(
      {
        message: `Account created, but profile setup failed: ${profileError.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Account created successfully." }, { status: 201 });
}
