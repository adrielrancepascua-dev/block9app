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
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)] bg-[var(--nav)] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(20,32,51,0.08)] backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-semibold active:scale-[0.98]"
                title={item.label}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    active ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--muted)]"
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`max-w-full truncate ${active ? "text-[var(--accent-text)]" : "text-[var(--muted)]"}`}>
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[var(--nav)] backdrop-blur-md md:block">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-6">
            <Link href="/" className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Block 9
            </Link>

            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    isActive(item.href)
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--surface)]"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full border border-[var(--line)] object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                  {(profile?.name?.trim()?.charAt(0) || "S").toUpperCase()}
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--ink)]">{profile?.name || "Student"}</p>
                <p className="text-xs text-[var(--muted)]">{profile?.role === "admin" ? "Admin" : "Student"}</p>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
