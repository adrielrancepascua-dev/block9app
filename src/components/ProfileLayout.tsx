"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { CLASS_PHOTO } from "@/utils/brand";

export default function ProfileLayout({
  children,
  customBgUrl,
  containerClassName,
  fill = false,
}: {
  children: ReactNode;
  customBgUrl?: string;
  containerClassName?: string;
  surface?: "glass" | "paper";
  fill?: boolean;
}) {
  const { profile } = useAuth();
  const widthClass = containerClassName?.trim() || "max-w-5xl";
  const bgUrl = customBgUrl || profile?.custom_bg_url || CLASS_PHOTO;

  return (
    <div className="relative min-h-[100dvh] w-full text-[var(--ink)]">
      <div
        className="pointer-events-none fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="pointer-events-none fixed inset-0 z-[-9] bg-[#07111f]/22" />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col ${
          fill
            ? "h-[100dvh] px-3 pt-3 pb-[calc(4.7rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-5 sm:pb-6"
            : "min-h-[100dvh] px-5 pt-7 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10 sm:pb-12"
        }`}
      >
        <div
          className={`mx-auto w-full ${widthClass} rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)] ${
            fill ? "flex min-h-0 flex-1 flex-col p-3 sm:p-4" : "p-5 sm:p-8"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
