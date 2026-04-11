"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Home, MessageSquare, Settings, ShieldAlert } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  // Don't show navbar on login page
  if (pathname === "/login") {
    return null;
  }

  // Define navigation items
  const navItems: NavItem[] = [
    {
      label: "Home",
      href: "/",
      icon: <Home className="h-5 w-5" />,
    },
    {
      label: "Freedom Wall",
      href: "/freedom-wall",
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
    },
    ...(profile?.role === "admin"
      ? [
          {
            label: "Admin",
            href: "/admin",
            icon: <ShieldAlert className="h-5 w-5" />,
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-white/20 bg-white/10 backdrop-blur-md">
        <div className="flex items-center justify-around gap-1 px-2 py-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                isActive(item.href)
                  ? "bg-blue-500/30 text-blue-600 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
              title={item.label}
            >
              <div className="flex items-center justify-center">
                {item.icon}
              </div>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop Top Navigation */}
      <nav className="sticky top-0 z-40 hidden border-b border-white/20 bg-white/10 backdrop-blur-md md:block">
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

      {/* Spacer for mobile to prevent content overlap */}
      <div className="h-16 md:hidden" />
    </>
  );
}
