"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";

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
  const bgUrl = customBgUrl || profile?.custom_bg_url || "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80";

  return (
    <div className="relative min-h-screen w-full text-slate-900 dark:text-slate-50">
      {/* 
        Fixed Background 
        We use an absolute div fixed to the viewport with object-cover equivalent behavior (bg-cover).
      */}
      <div
        className="fixed inset-0 z-[-10] pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-500"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />

      {/* Main Content Wrapper */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-3 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-8 sm:pb-8">
        
        {/* 
          Glassmorphism Container
          - bg-white/10: 10% opacity white background
          - backdrop-blur-md: Medium blur behind the container
          - border border-white/20: Subtle translucent border
        */}
        <div className={`w-full ${widthClass} rounded-xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md sm:rounded-2xl sm:p-6`}>
          {children}
        </div>

      </main>
    </div>
  );
}
