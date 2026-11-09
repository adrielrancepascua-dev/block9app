"use client";

import { useEffect } from "react";

function systemBarsHidden() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    document.fullscreenElement != null
  );
}

export default function PhoneChrome() {
  useEffect(() => {
    const android = /Android/i.test(navigator.userAgent);
    if (!android) return;

    let leftFullscreen = false;

    const enter = (event: Event) => {
      if (leftFullscreen || systemBarsHidden()) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const root = document.documentElement as HTMLElement & {
        requestFullscreen?: (options?: { navigationUI?: "auto" | "hide" | "show" }) => Promise<void>;
      };
      root.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && sessionStorage.getItem("block9-fullscreen-entered") === "1") {
        leftFullscreen = true;
      }
      if (document.fullscreenElement) sessionStorage.setItem("block9-fullscreen-entered", "1");
    };

    document.addEventListener("pointerdown", enter);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("pointerdown", enter);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return null;
}
