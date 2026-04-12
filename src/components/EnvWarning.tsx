"use client";

import React from "react";

export default function EnvWarning() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-50 flex justify-center">
      <div className="mx-4 w-full max-w-6xl rounded-md border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800 shadow-sm">
        <strong className="mr-2">Configuration</strong>
        Missing Supabase environment variables. Please set <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> in your Vercel Project Settings (Preview & Production) for the app to work correctly.
      </div>
    </div>
  );
}
