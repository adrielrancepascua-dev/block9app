"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";

const AUTH_PATHS = new Set(["/login", "/register", "/welcome"]);

export default function NameGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profileReady || !user) return;

    const needsName = !profile || profile.name_confirmed !== true;
    if (needsName && pathname !== "/welcome") {
      router.replace("/welcome");
      return;
    }

    if (!needsName && AUTH_PATHS.has(pathname)) {
      router.replace("/");
    }
  }, [user, profile, loading, profileReady, pathname, router]);

  return children;
}
