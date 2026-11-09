"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Share, X } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";

type InstallMode = "native" | "ios-safari" | "ios-other" | "manual";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "block9-install-dismissed";

function dismissedPaths() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

function isIosSafari() {
  const ua = navigator.userAgent;
  return isIos() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/.test(ua);
}

function detectMode(): InstallMode | "installed" {
  if (isStandalone()) return "installed";
  if (isIos()) return isIosSafari() ? "ios-safari" : "ios-other";
  return "manual";
}

function emptySubscribe() {
  return () => {};
}

function subscribeDismiss(onChange: () => void) {
  window.addEventListener("block9-install-dismiss", onChange);
  return () => window.removeEventListener("block9-install-dismiss", onChange);
}

let workerBooted = false;

async function registerWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || workerBooted) return;
  workerBooted = true;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const applyWaiting = () => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      const last = Number(sessionStorage.getItem("block9-sw-reload") || 0);
      if (Date.now() - last < 10000) return;
      sessionStorage.setItem("block9-sw-reload", String(Date.now()));
      window.location.reload();
    });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") applyWaiting();
      });
    });
    applyWaiting();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      registration.update().then(applyWaiting).catch(() => {});
    });
  } catch {
    workerBooted = false;
  }
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const panelRef = useRef<HTMLElement>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const detected = useSyncExternalStore(emptySubscribe, detectMode, () => "server" as const);
  const dismissedKey = useSyncExternalStore(subscribeDismiss, () => dismissedPaths().join("\n"), () => "");
  const dismissed = dismissedKey ? dismissedKey.split("\n") : [];
  const mode: InstallMode | null =
    installed || detected === "server" || detected === "installed" ? null : promptEvent ? "native" : detected;
  const onAuth = pathname === "/login" || pathname === "/register" || pathname === "/welcome";
  const navVisible = Boolean(user && profile?.name_confirmed === true) && !onAuth;
  const visible = Boolean(mode) && !dismissed.includes(pathname);

  useEffect(() => {
    registerWorker();
    const onNative = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onNative);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onNative);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!visible || !node) {
      document.documentElement.style.removeProperty("--install-prompt-bottom");
      document.documentElement.style.removeProperty("--install-prompt-inset");
      return;
    }

    const write = () => {
      const rect = node.getBoundingClientRect();
      const nav = [...document.querySelectorAll("nav")].find((el) => el.getClientRects().length > 0);
      const navPosition = nav ? getComputedStyle(nav).position : "fixed";
      const origin = nav && navPosition !== "fixed" ? nav.getBoundingClientRect().bottom : 0;
      const bottom = Math.ceil(rect.bottom + 10);
      const inset = Math.max(0, Math.ceil(rect.bottom - origin + 10));
      document.documentElement.style.setProperty("--install-prompt-bottom", `${bottom}px`);
      document.documentElement.style.setProperty("--install-prompt-inset", `${inset}px`);
    };

    write();
    const observer = new ResizeObserver(write);
    observer.observe(node);
    window.addEventListener("resize", write);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", write);
      document.documentElement.style.removeProperty("--install-prompt-bottom");
      document.documentElement.style.removeProperty("--install-prompt-inset");
    };
  }, [visible, navVisible, pathname]);

  if (!visible) return null;

  const dismiss = () => {
    const next = [...new Set([...dismissed, pathname])];
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("block9-install-dismiss"));
  };

  const install = async () => {
    if (!promptEvent || installing) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setMode(null);
      setPromptEvent(null);
    } finally {
      setInstalling(false);
    }
  };

  const position = navVisible
    ? "top-[max(0.75rem,env(safe-area-inset-top))] md:top-[calc(4.35rem+env(safe-area-inset-top))] md:right-6 md:left-auto"
    : "top-[max(0.75rem,env(safe-area-inset-top))]";

  return (
    <aside
      ref={panelRef}
      role="region"
      aria-label="Add Block 9 to your home screen"
      className={`fixed inset-x-3 z-[60] mx-auto max-w-md ${position}`}
    >
      <div className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--card)] p-3 text-[var(--ink)] shadow-[0_16px_40px_rgba(20,32,51,0.2)]">
        <Image src="/icon-192.png" alt="" width={48} height={48} priority className="h-12 w-12 shrink-0 rounded-[0.9rem]" />
        <div className="min-w-0 flex-1">
          <p className="text-pretty text-sm font-semibold leading-tight">
            {mode === "ios-other" ? "Open Block 9 in Safari" : "Add Block 9"}
          </p>
          <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
            {mode === "native" ? (
              "Install it and the schedule opens full screen, with no browser bar."
            ) : mode === "ios-safari" ? (
              <>
                Tap <Share aria-hidden="true" className="inline h-3.5 w-3.5 align-[-2px]" /> Share, then Add to Home
                Screen. It opens full screen after that.
              </>
            ) : mode === "ios-other" ? (
              "This browser can’t add it to the Home Screen. Open this page in Safari, tap Share, then Add to Home Screen."
            ) : (
              "Open the browser menu and choose Install app or Add to Home screen. It opens full screen after that."
            )}
          </p>
          {mode === "native" ? (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="mt-2 inline-flex min-h-10 touch-manipulation items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#173f74] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-70"
            >
              {installing ? "Installing…" : "Install"}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--quiet)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
