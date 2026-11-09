import Link from "next/link";
import type { ReactNode } from "react";
import AuthBackdrop from "@/components/AuthBackdrop";

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden px-4 py-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))]">
      <AuthBackdrop />
      <div className="auth-card relative z-10 w-full max-w-[26.5rem] rounded-2xl border border-white/20 bg-[#0d1b2e]/82 p-6 shadow-[0_24px_70px_rgba(4,10,20,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-7">
          <Link href="/" className="text-sm font-semibold tracking-tight text-sky-200">
            Block9
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/75">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export const authInputClass = (invalid = false) =>
  `w-full rounded-xl border bg-white/10 py-3 pl-11 pr-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none transition placeholder:text-white/65 focus:ring-2 disabled:opacity-60 ${
    invalid
      ? "border-rose-300/70 focus:border-rose-200 focus:ring-rose-300/30"
      : "border-white/20 focus:border-sky-200/80 focus:ring-sky-200/25"
  }`;

export const authButtonClass =
  "mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,42,84,0.35)] transition hover:bg-[#2460ad] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1d4f91]/55 disabled:active:scale-100";
