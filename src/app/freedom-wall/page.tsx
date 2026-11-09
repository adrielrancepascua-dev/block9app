"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import FreedomWall from "@/components/FreedomWall";
import AppLoading from "@/components/AppLoading";

export default function FreedomWallPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) return <AppLoading />;

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Redirecting to login...</div>;
  }

  return (
    <div className="fixed inset-0 z-10 pt-[var(--install-prompt-bottom,0px)] md:pt-[max(4rem,var(--install-prompt-bottom,0px))]">
      <FreedomWall />
    </div>
  );
}
