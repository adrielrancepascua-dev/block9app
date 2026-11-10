"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { CLASS_PHOTO } from "@/utils/brand";
import ChromeTint from "@/components/ChromeTint";

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
    <div className={`relative isolate w-full text-[var(--ink)] ${fill ? "flex min-h-0 flex-1 flex-col" : "min-h-[100dvh]"}`}>
      <ChromeTint source={bgUrl} />
      <div
        className="pointer-events-none fixed inset-0 bg-no-repeat"
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: "auto 230%",
          backgroundPosition: "center 78%",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,17,31,0.42) 0%, rgba(7,17,31,0.18) 22%, rgba(7,17,31,0.12) 48%, rgba(7,17,31,0.5) 100%)",
        }}
      />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col ${
          fill
            ? "h-[100dvh] px-0 pt-[max(env(safe-area-inset-top),var(--install-prompt-bottom,0px))] pb-[calc(72px+env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)] md:px-8 md:pt-[max(1rem,var(--install-prompt-inset,0px))] md:pb-4"
            : "min-h-[100dvh] px-5 pt-[max(1.75rem,var(--install-prompt-bottom,0px))] pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-[max(2.5rem,var(--install-prompt-inset,0px))] sm:pb-12"
        }`}
      >
        <div
          className={`mx-auto w-full ${widthClass} text-[var(--ink)] ${
            fill
              ? "flex min-h-0 flex-1 flex-col"
              : "rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_1px_2px_rgba(20,32,51,0.05),0_22px_50px_rgba(20,32,51,0.14)] sm:p-8"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
