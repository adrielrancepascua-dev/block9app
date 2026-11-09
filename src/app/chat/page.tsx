"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ChatRoom from "@/components/ChatRoom";
import AppLoading from "@/components/AppLoading";
import { CLASS_PHOTO } from "@/utils/brand";

export default function ChatPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const bgUrl =
    profile?.custom_bg_url ||
    CLASS_PHOTO;

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
    <div className="relative min-h-[100dvh] text-[var(--ink)]">
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="fixed inset-0 -z-10 bg-[#07111f]/22" />

      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-6 md:pt-6">
        <div className="h-[calc(100dvh-8.75rem)] md:h-[calc(100dvh-7.25rem)]">
          <ChatRoom />
        </div>
      </div>
    </div>
  );
}
