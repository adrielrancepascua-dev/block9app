"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ChatRoom from "@/components/ChatRoom";

export default function ChatPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const bgUrl =
    profile?.custom_bg_url ||
    "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80";

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
    <div className="relative min-h-screen text-slate-50">
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="fixed inset-0 -z-10 bg-slate-900/35" />

      <div className="mx-auto w-full max-w-screen-2xl px-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 md:px-4 md:pb-4 md:pt-4">
        <div className="h-[calc(100dvh-6.9rem)] md:h-[calc(100dvh-6.1rem)]">
          <ChatRoom />
        </div>
      </div>
    </div>
  );
}
