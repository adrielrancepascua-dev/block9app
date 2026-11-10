"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ChatRoom from "@/components/ChatRoom";
import AppLoading from "@/components/AppLoading";
import { CLASS_PHOTO } from "@/utils/brand";
import ChromeTint from "@/components/ChromeTint";

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
    <div className="relative isolate min-h-[100dvh] text-[var(--ink)]">
      <ChromeTint source={bgUrl} />
      <div
        className="fixed inset-0 bg-no-repeat"
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: "auto 230%",
          backgroundPosition: "center 78%",
        }}
      />
      <div className="fixed inset-0 bg-[#07111f]/25" />

      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-[max(1.25rem,var(--install-prompt-bottom,0px))] pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-[max(1.5rem,var(--install-prompt-inset,0px))] md:pb-6">
        <div className="h-[calc(100dvh-7.5rem-max(1.25rem,var(--install-prompt-bottom,0px)))] md:h-[calc(100dvh-5.75rem-max(1.5rem,var(--install-prompt-inset,0px)))]">
          <ChatRoom />
        </div>
      </div>
    </div>
  );
}
