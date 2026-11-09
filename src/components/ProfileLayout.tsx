"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { CLASS_PHOTO } from "@/utils/brand";

export default function ProfileLayout({ 
  children, 
  customBgUrl,
  containerClassName,
}: { 
  children: ReactNode;
  customBgUrl?: string;
  containerClassName?: string;
}) {
  const { profile } = useAuth();
  const widthClass = containerClassName?.trim() || "max-w-5xl";

  // Use the passed customBgUrl for preview, fall back to profile's custom_bg_url, then use default
  const bgUrl = customBgUrl || profile?.custom_bg_url || CLASS_PHOTO;

  return (
    <div className="relative min-h-screen w-full text-slate-900 dark:text-slate-50">
      {/* 
        Fixed Background 
        We use an absolute div fixed to the viewport with object-cover equivalent behavior (bg-cover).
      */}
      <div
        className="pointer-events-none fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />
      <div className="pointer-events-none fixed inset-0 z-[-9] bg-[#07111f]/40" />

      {/* Main Content Wrapper */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-3 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-8 sm:pb-8">
        
        {/* 
          Glassmorphism Container
          - bg-white/10: 10% opacity white background
          - backdrop-blur-md: Medium blur behind the container
          - border border-white/20: Subtle translucent border
        */}
        <div className={`w-full ${widthClass} rounded-2xl border border-white/50 bg-white/90 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-[#0d1b2e]/88`}>
          {children}
        </div>

      </main>
    </div>
  );
}
