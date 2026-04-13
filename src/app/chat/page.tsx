"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import ChatRoom from "@/components/ChatRoom";

export default function ChatPage() {
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
    <ProfileLayout containerClassName="max-w-7xl">
      <div className="w-full">
        <div className="mb-5 sm:mb-7">
          <h1 className="text-2xl font-bold text-slate-800 drop-shadow-md sm:text-3xl dark:text-white">
            Community Chat
          </h1>
        </div>

        <ChatRoom />
      </div>
    </ProfileLayout>
  );
}
