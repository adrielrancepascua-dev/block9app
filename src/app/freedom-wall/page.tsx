"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
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

  if (loading) {
    return (
      <AppLoading />
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Redirecting to login...
      </div>
    );
  }

  return (
    <ProfileLayout surface="paper" containerClassName="max-w-6xl">
      <div className="w-full">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-[1.85rem] font-semibold tracking-tight text-[#142033] sm:text-4xl">
            Freedom Wall
          </h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-[#4d5d73]">
            A cork board for the block. Leave a short note, with your name or without it.
          </p>
        </header>
        <FreedomWall />
      </div>
    </ProfileLayout>
  );
}
