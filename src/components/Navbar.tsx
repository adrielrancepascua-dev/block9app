"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Home, MessageCircle, MessageSquare, Settings, ShieldAlert } from "lucide-react";

interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ReactNode;
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  if (pathname === "/login" || pathname === "/register" || pathname === "/welcome" || (user && profile && profile.name_confirmed !== true)) {
    return null;
  }

  const navItems: NavItem[] = [
    {
      label: "Home",
      shortLabel: "Home",
      href: "/",
      icon: <Home className="h-5 w-5" strokeWidth={1.75} />,
    },
    {
      label: "Freedom Wall",
      shortLabel: "Wall",
      href: "/freedom-wall",
      icon: <MessageSquare className="h-5 w-5" strokeWidth={1.75} />,
    },
    {
      label: "Chat",
      shortLabel: "Chat",
      href: "/chat",
      icon: <MessageCircle className="h-5 w-5" strokeWidth={1.75} />,
    },
    {
      label: "Settings",
      shortLabel: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" strokeWidth={1.75} />,
    },
    ...(profile?.role === "admin"
      ? [
          {
            label: "Admin",
            shortLabel: "Admin",
            href: "/admin",
            icon: <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />,
          },
        ]
      : []),
  ];

  // Check if route is active
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#07111f]/90">
        <div className="flex items-stretch justify-around gap-0.5 px-1 pt-1.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition active:scale-[0.98] ${
                isActive(item.href)
                  ? "bg-[#1d4f91]/12 text-[#1d4f91] dark:bg-sky-300/15 dark:text-sky-200"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop Top Navigation */}
      <nav className="sticky top-0 z-40 hidden border-b border-slate-200/80 bg-white/85 backdrop-blur-xl md:block dark:border-white/10 dark:bg-[#07111f]/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Logo/Brand */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-xl font-bold text-slate-900 dark:text-white"
              >
                Block9
              </Link>
            </div>

            {/* Center: Navigation Items */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? "bg-blue-500/30 text-blue-600 dark:text-blue-300"
                      : "text-slate-600 hover:bg-white/20 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Right: User Profile Info */}
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-9 w-9 rounded-full border border-white/30 object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-blue-600/80 text-sm font-bold text-white">
                  {(profile?.name?.trim()?.charAt(0) || "S").toUpperCase()}
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile?.name || "Student"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profile?.role === "admin" ? "Admin" : "Student"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

    </>
  );
}
