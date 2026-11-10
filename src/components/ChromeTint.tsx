"use client";

import { useEffect } from "react";
import { applyChromeColor, chromeColorFromImage } from "@/utils/chrome-color";

export default function ChromeTint({ source }: { source: string }) {
  useEffect(() => {
    let cancelled = false;
    if (source.startsWith("#")) {
      applyChromeColor(source);
      return;
    }
    chromeColorFromImage(source)
      .then((color) => {
        if (!cancelled) applyChromeColor(color);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source]);

  return null;
}
