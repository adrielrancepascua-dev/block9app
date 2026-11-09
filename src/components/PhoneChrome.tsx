"use client";

import { useEffect } from "react";

export default function PhoneChrome() {
  useEffect(() => {
    if (!/Android/i.test(navigator.userAgent)) return;

    const enter = () => {
      const root = document.documentElement as HTMLElement & {
        requestFullscreen?: (options?: { navigationUI?: "auto" | "hide" | "show" }) => Promise<void>;
        webkitRequestFullscreen?: () => void;
      };
      if (document.fullscreenElement) return;
      if (root.requestFullscreen) {
        root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        return;
      }
      root.webkitRequestFullscreen?.();
    };

    document.addEventListener("pointerdown", enter, true);
    return () => document.removeEventListener("pointerdown", enter, true);
  }, []);

  return null;
}
