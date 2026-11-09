"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronUp, Clock3, MapPin } from "lucide-react";

export type SheetPhase = "closed" | "peek" | "expanded";

interface ClassItem {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string | null;
}

const PEEK_HEIGHT = 152;

const formatTime = (timeStr?: string | null) => {
  if (!timeStr) return "";
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatSpan = (start?: string | null, end?: string | null) => {
  const startLabel = formatTime(start);
  const endLabel = formatTime(end);
  if (!endLabel) return startLabel ? `${startLabel} · Dismissal not set` : "Time not set";
  return `${startLabel} - ${endLabel}`;
};

const sheetHeight = (count: number) => {
  const content = 92 + (count === 0 ? 64 : count * 104) + 24;
  if (typeof window === "undefined") return Math.max(content, PEEK_HEIGHT + 24);
  const cap = Math.min(window.innerHeight * 0.78, window.innerHeight - 96, 640);
  return Math.min(Math.max(content, PEEK_HEIGHT + 24), cap);
};

export default function DayClassSheet({
  phase,
  dateLabel,
  classes,
  onClose,
  onExpand,
  onCollapse,
}: {
  phase: SheetPhase;
  dateLabel: string;
  classes: ClassItem[];
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const dragZoneRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [height, setHeight] = useState(() => sheetHeight(classes.length));
  const [navOffset, setNavOffset] = useState(0);
  const heightRef = useRef(height);
  const dragYRef = useRef(0);
  const draggedRef = useRef(false);
  const pointerHandledRef = useRef(false);
  const phaseRef = useRef(phase);
  const onCloseRef = useRef(onClose);
  const onExpandRef = useRef(onExpand);
  const onCollapseRef = useRef(onCollapse);

  phaseRef.current = phase;
  dragYRef.current = dragY;
  heightRef.current = height;
  onCloseRef.current = onClose;
  onExpandRef.current = onExpand;
  onCollapseRef.current = onCollapse;

  const hiddenOffset = Math.max(0, height - PEEK_HEIGHT);
  const snapOffset = phase === "expanded" ? 0 : hiddenOffset;
  const translateY = hasEntered ? snapOffset + dragY : height + 32;
  const progress = hiddenOffset <= 0 ? 1 : Math.min(1, Math.max(0, 1 - translateY / hiddenOffset));

  useLayoutEffect(() => {
    const measure = () => {
      const nav = document.querySelector("nav.fixed.bottom-0");
      if (!(nav instanceof HTMLElement)) {
        setNavOffset(0);
        return;
      }
      const top = nav.getBoundingClientRect().top;
      const offset = Math.floor(window.innerHeight - top) - 1;
      setNavOffset(nav.offsetHeight < 8 ? 0 : Math.max(0, offset));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (phase === "closed") {
      setHasEntered(false);
      setDragY(0);
      return;
    }
    setHeight(sheetHeight(classes.length));
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [phase === "closed", dateLabel, classes.length]);

  useEffect(() => {
    setDragY(0);
    dragYRef.current = 0;
  }, [phase]);

  useEffect(() => {
    const zone = dragZoneRef.current;
    if (!zone || phase === "closed") return;

    const hiddenNow = () => Math.max(0, heightRef.current - PEEK_HEIGHT);
    let dragging = false;
    let startY = 0;
    let startDrag = 0;

    const clampDrag = (next: number) => {
      const hidden = hiddenNow();
      if (phaseRef.current === "peek") return Math.min(Math.max(next, -hidden), 140);
      return Math.min(Math.max(next, -24), hidden + 120);
    };

    const finish = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);
      const current = dragYRef.current;
      const hidden = hiddenNow();
      const currentPhase = phaseRef.current;
      if (!draggedRef.current) {
        pointerHandledRef.current = true;
        setDragY(0);
        if (currentPhase === "peek") onExpandRef.current();
        else onCollapseRef.current();
        return;
      }
      if (currentPhase === "peek") {
        if (current < -hidden * 0.28) {
          setDragY(0);
          onExpandRef.current();
          return;
        }
        if (current > 72) {
          setDragY(0);
          onCloseRef.current();
          return;
        }
      } else if (current > hidden * 0.32) {
        setDragY(0);
        onCollapseRef.current();
        return;
      }
      setDragY(0);
      dragYRef.current = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      draggedRef.current = false;
      pointerHandledRef.current = false;
      setIsDragging(true);
      startY = event.clientY;
      startDrag = dragYRef.current;
      zone.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      if (Math.abs(event.clientY - startY) > 6) draggedRef.current = true;
      const next = clampDrag(startDrag + (event.clientY - startY));
      dragYRef.current = next;
      setDragY(next);
    };

    zone.addEventListener("pointerdown", onPointerDown);
    zone.addEventListener("pointermove", onPointerMove);
    zone.addEventListener("pointerup", finish);
    zone.addEventListener("pointercancel", finish);
    return () => {
      zone.removeEventListener("pointerdown", onPointerDown);
      zone.removeEventListener("pointermove", onPointerMove);
      zone.removeEventListener("pointerup", finish);
      zone.removeEventListener("pointercancel", finish);
    };
  }, [phase]);

  if (phase === "closed") return null;

  const preview = classes
    .slice(0, 2)
    .map((item) => item.subject)
    .join(" · ");
  const extra = Math.max(0, classes.length - 2);
  const expanded = phase === "expanded";

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close the day preview"
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(20, 32, 51, ${isDragging ? 0.16 + progress * 0.28 : expanded ? 0.42 : 0.18})` }}
        onClick={() => (expanded ? onCollapse() : onClose())}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden md:inset-x-auto md:left-1/2 md:w-[min(64rem,calc(100%-4rem))] md:-translate-x-1/2"
        style={{ bottom: navOffset }}
      >
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[1.35rem] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_-12px_32px_rgba(20,32,51,0.18)]"
        style={{
          height,
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div ref={dragZoneRef} className="shrink-0 touch-none select-none">
          <button
            type="button"
            className="flex w-full flex-col items-center px-4 pt-3 pb-2"
            aria-label={expanded ? "Swipe down to minimize" : "Swipe up to see the day"}
            onClick={() => {
              if (draggedRef.current || pointerHandledRef.current) return;
              if (expanded) onCollapse();
              else onExpand();
            }}
          >
            <span className="h-1.5 w-14 rounded-full bg-[var(--line)]" />
            <span className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
              <ChevronUp className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Swipe down" : "Swipe up"}
            </span>
          </button>
          {!expanded ? (
            <div className="px-4 pb-4 text-left">
              <p className="text-base font-semibold">{dateLabel}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                {classes.length === 0 ? "No classes" : `${classes.length} class${classes.length === 1 ? "" : "es"}`}
              </p>
              {classes.length > 0 ? (
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {preview}
                  {extra > 0 ? ` · +${extra} more` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {expanded ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <p className="text-lg font-semibold">{dateLabel}</p>
            {classes.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Nothing scheduled.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {classes.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--quiet)] px-3 py-3">
                    <p className="text-base font-semibold">{item.subject}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatSpan(item.start_time, item.end_time)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.room || "Room not set"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
