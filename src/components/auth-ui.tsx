import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AuthBackdrop from "@/components/AuthBackdrop";

export function AuthScreen({
  subtitle,
  children,
}: {
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden px-8 py-[max(3.5rem,env(safe-area-inset-top))] pb-[max(3.5rem,env(safe-area-inset-bottom))] sm:px-10">
      <AuthBackdrop />
      <div
        className="auth-card relative z-10 w-full max-w-[21rem] rounded-[1.6rem] px-6 py-8 text-white sm:max-w-[23rem] sm:px-8 sm:py-10"
        style={{ backdropFilter: "blur(28px) saturate(1.45)", WebkitBackdropFilter: "blur(28px) saturate(1.45)" }}
      >
        <div className="mb-8 text-center">
          <p className="text-[2.15rem] font-semibold leading-none tracking-[0.22em] text-white sm:text-[2.45rem]">
            BLOCK 9
          </p>
          <p className="mx-auto mt-4 max-w-[16rem] text-sm leading-relaxed text-white/80">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GoogleButton({
  label,
  pending,
  onClick,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-[#142033] shadow-[0_10px_24px_rgba(7,17,31,0.18)] transition hover:bg-white/92 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
      {pending ? "Opening Google" : label}
    </button>
  );
}

export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-white/80">
      {prompt}{" "}
      <Link href={href} className="font-semibold text-white underline decoration-white/40 underline-offset-4">
        {label}
      </Link>
    </p>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
