"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import FreedomWall from "@/components/FreedomWall";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
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
    <ProfileLayout>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 drop-shadow-md dark:text-white">
            Freedom Wall 💬
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            Share your thoughts with the community. Post anonymously if you prefer!
          </p>
        </div>
        <FreedomWall />
      </div>
    </ProfileLayout>
  );
}
