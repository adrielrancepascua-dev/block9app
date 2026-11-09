"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { CLASS_PHOTO } from "@/utils/brand";

export default function ProfileLayout({
  children,
  customBgUrl,
  containerClassName,
  surface = "glass",
}: {
  children: ReactNode;
  customBgUrl?: string;
  containerClassName?: string;
  surface?: "glass" | "paper";
}) {
  const { profile } = useAuth();
  const widthClass = containerClassName?.trim() || "max-w-5xl";
  const bgUrl = customBgUrl || profile?.custom_bg_url || CLASS_PHOTO;
  const paper = surface === "paper";

  return (
    <div className="relative min-h-[100dvh] w-full">
      <div
        className="pointer-events-none fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="pointer-events-none fixed inset-0 z-[-9] bg-[#07111f]/22" />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-7 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10 sm:pb-12">
        <div
          className={`mx-auto w-full ${widthClass} rounded-[1.75rem] p-5 sm:p-8 ${
            paper
              ? "border border-white/80 bg-[#f7f4ef]/96 text-[#142033] shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)]"
              : "border border-white/60 bg-white/92 text-slate-900 shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101c2e]/88 dark:text-slate-50"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
