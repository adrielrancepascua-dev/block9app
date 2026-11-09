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
    <div className={`relative w-full text-[var(--ink)] ${fill ? "flex min-h-0 flex-1 flex-col" : "min-h-[100dvh]"}`}>
      <div
        className="pointer-events-none fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="pointer-events-none fixed inset-0 z-[-9] bg-[#07111f]/22" />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col ${
          fill
            ? "h-[100dvh] px-0 pt-[max(env(safe-area-inset-top),var(--install-prompt-bottom,0px))] pb-[calc(72px+env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)] md:px-8 md:pt-[max(1rem,var(--install-prompt-inset,0px))] md:pb-4"
            : "min-h-[100dvh] px-5 pt-[max(1.75rem,var(--install-prompt-bottom,0px))] pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-[max(2.5rem,var(--install-prompt-inset,0px))] sm:pb-12"
        }`}
      >
        <div
          className={`mx-auto w-full ${widthClass} bg-[var(--card)] text-[var(--ink)] ${
            fill
              ? "flex min-h-0 flex-1 flex-col rounded-none border-0 p-4 shadow-none md:rounded-[1.75rem] md:border md:border-[var(--line)] md:shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)]"
              : "rounded-[1.75rem] border border-[var(--line)] p-5 shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)] sm:p-8"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
