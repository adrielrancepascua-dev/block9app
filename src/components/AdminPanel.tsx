"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/context/SupabaseAuthContext";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

const HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const atLocal = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

const hourLabel = (hour: number) => {
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${suffix}`;
};

const fieldClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_45%,transparent)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

const WHEEL_ITEM = 44;

function wheelItems(current: string, base: { value: string; label: string }[], blank: string) {
  if (!current || base.some((item) => item.value === current)) return [{ value: "", label: blank }, ...base];
  const extra = { value: current, label: current };
  return [{ value: "", label: blank }, extra, ...base];
}

function WheelColumn({
  label,
  items,
  value,
  onSelect,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onSelect: (next: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchedRef = useRef(false);
  const itemsRef = useRef(items);
  const valueRef = useRef(value);
  const onSelectRef = useRef(onSelect);
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((item) => item.value === value)));

  useEffect(() => {
    itemsRef.current = items;
    valueRef.current = value;
    onSelectRef.current = onSelect;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const index = Math.max(0, items.findIndex((item) => item.value === value));
    const target = index * WHEEL_ITEM;
    if (Math.abs(scroller.scrollTop - target) > 2) scroller.scrollTop = target;
  }, [items, onSelect, value]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let timer = 0;
    const commit = () => {
      if (!touchedRef.current) return;
      const list = itemsRef.current;
      const index = Math.min(list.length - 1, Math.max(0, Math.round(scroller.scrollTop / WHEEL_ITEM)));
      const next = list[index]?.value ?? "";
      if (next !== valueRef.current) onSelectRef.current(next);
    };
    const onScroll = () => {
      const list = itemsRef.current;
      setActive(Math.min(list.length - 1, Math.max(0, Math.round(scroller.scrollTop / WHEEL_ITEM))));
      window.clearTimeout(timer);
      timer = window.setTimeout(commit, 90);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", commit);
    return () => {
      window.clearTimeout(timer);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", commit);
    };
  }, []);

  const move = (direction: number) => {
    touchedRef.current = true;
    const current = Math.max(0, items.findIndex((item) => item.value === value));
    const next = Math.min(items.length - 1, Math.max(0, current + direction));
    onSelect(items[next]?.value ?? "");
  };

  return (
    <div className="min-w-0">
      <div
        ref={scrollerRef}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        onPointerDown={() => {
          touchedRef.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
        }}
        className="h-[132px] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)",
        }}
      >
        <div className="h-11 shrink-0" aria-hidden="true" />
        {items.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={`${item.value}-${item.label}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={`flex h-11 w-full snap-center items-center justify-center text-sm font-semibold tabular-nums ${
                selected ? "text-white" : "text-[var(--muted)]"
              }`}
              onClick={() => {
                touchedRef.current = true;
                onSelect(item.value);
              }}
            >
              {item.label}
            </button>
          );
        })}
        <div className="h-11 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

function TimeChoice({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [pendingHour, setPendingHour] = useState("");
  const [pendingMinute, setPendingMinute] = useState("");
  const hour = value.length >= 2 ? value.slice(0, 2) : "";
  const minute = value.length >= 5 ? value.slice(3, 5) : "";
  const shownHour = hour || pendingHour;
  const shownMinute = minute || pendingMinute;

  const publish = (nextHour: string, nextMinute: string) => {
    setPendingHour(nextHour);
    setPendingMinute(nextMinute);
    onChange(nextHour && nextMinute ? `${nextHour}:${nextMinute}` : "");
  };

  const hours = useMemo(
    () =>
      wheelItems(
        shownHour,
        HOURS.map((item) => ({ value: String(item).padStart(2, "0"), label: hourLabel(item) })),
        "Hour"
      ),
    [shownHour]
  );
  const minutes = useMemo(
    () =>
      wheelItems(
        shownMinute,
        MINUTES.map((item) => {
          const key = String(item).padStart(2, "0");
          return { value: key, label: key };
        }),
        "Min"
      ),
    [shownMinute]
  );

  return (
    <div id={id} className="relative grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-1 py-1">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-[var(--accent)]" aria-hidden="true" />
      <WheelColumn label="Hour" items={hours} value={shownHour} onSelect={(next) => publish(next, shownMinute)} />
      <WheelColumn label="Minute" items={minutes} value={shownMinute} onSelect={(next) => publish(shownHour, next)} />
    </div>
  );
}

const toDateInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const toTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export interface EditableSchedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string | null;
}

export default function AdminPanel({
  initialDate,
  schedule,
  onCreated,
  onClose,
}: {
  initialDate?: string;
  schedule?: EditableSchedule | null;
  onCreated?: () => void;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const editing = Boolean(schedule);
  const [subject, setSubject] = useState(schedule?.subject ?? "");
  const [room, setRoom] = useState(schedule?.room ?? "");
  const [date, setDate] = useState(schedule ? toDateInput(schedule.start_time) : initialDate || "");
  const [startTime, setStartTime] = useState(schedule ? toTimeInput(schedule.start_time) : "");
  const [endTime, setEndTime] = useState(schedule ? toTimeInput(schedule.end_time) : "");
  const [weeks, setWeeks] = useState<1 | 4>(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !room.trim() || !date || !startTime) {
      setError("Add the subject, room, day, and start time.");
      return;
    }

    const firstStart = atLocal(date, startTime);
    if (Number.isNaN(firstStart.getTime())) {
      setError("That day or start time is not valid.");
      return;
    }

    let firstEnd: Date | null = null;
    if (endTime) {
      firstEnd = atLocal(date, endTime);
      if (Number.isNaN(firstEnd.getTime()) || firstEnd <= firstStart) {
        if (firstEnd && firstEnd <= firstStart) {
          firstEnd = new Date(firstEnd.getTime() + 24 * 60 * 60 * 1000);
        } else {
          setError("That end time is not valid.");
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError("");

    const duration = firstEnd ? firstEnd.getTime() - firstStart.getTime() : null;
    if (schedule) {
      const { error: updateError } = await supabase
        .from("schedules")
        .update({
          subject: subject.trim(),
          room: room.trim(),
          start_time: firstStart.toISOString(),
          end_time: firstEnd ? firstEnd.toISOString() : null,
        })
        .eq("id", schedule.id);
      setIsSubmitting(false);
      if (updateError) {
        setError(updateError.message);
        toast.error("Could not update that class.");
        return;
      }
      toast.success("Class updated.");
      onCreated?.();
      return;
    }

    const rows = Array.from({ length: weeks }, (_, week) => {
      const start = new Date(firstStart);
      start.setDate(start.getDate() + week * 7);
      return {
        subject: subject.trim(),
        room: room.trim(),
        start_time: start.toISOString(),
        end_time: duration === null ? null : new Date(start.getTime() + duration).toISOString(),
        created_by: user?.id,
      };
    });

    const { error: insertError } = await supabase.from("schedules").insert(rows);
    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      toast.error("Could not add that class.");
      return;
    }

    toast.success(weeks === 1 ? "Class added." : "Class added for the next 4 weeks.");
    setSubject("");
    setRoom("");
    setStartTime("");
    setEndTime("");
    onCreated?.();
  };

  return (
    <form onSubmit={onSubmit} className="bg-[var(--surface)] text-[var(--ink)]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[var(--surface)] px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
        <div>
          <h2 className="text-pretty text-2xl font-semibold tracking-tight">{editing ? "Edit class" : "Add a class"}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {editing ? "Change this class, or leave the end time empty." : "Leave the end time empty when dismissal is not set yet."}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--quiet)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Close"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
        <div>
          <label htmlFor="subject" className="mb-2 block text-sm font-semibold">
            Subject
          </label>
          <input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className={fieldClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="room" className="mb-2 block text-sm font-semibold">
              Room
            </label>
            <input id="room" value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Room" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="class-date" className="mb-2 block text-sm font-semibold">
              Day
            </label>
            <input id="class-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold">Starts</p>
            <TimeChoice id="start-time" value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Ends</p>
            <TimeChoice id="end-time" value={endTime} onChange={setEndTime} />
          </div>
        </div>

        {editing ? null : (
        <div>
          <p className="mb-2 text-sm font-semibold">Repeat</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWeeks(1)}
              className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${
                weeks === 1 ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-[var(--quiet)] text-[var(--ink)]"
              }`}
            >
              This day
            </button>
            <button
              type="button"
              onClick={() => setWeeks(4)}
              className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${
                weeks === 4 ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-[var(--quiet)] text-[var(--ink)]"
              }`}
            >
              Next 4 weeks
            </button>
          </div>
        </div>
        )}

        {error ? <p className="text-sm text-[#9f2d3a]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#2460ad] active:scale-[0.98] disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? (editing ? "Saving" : "Adding") : editing ? "Save class" : weeks === 4 ? "Add 4 classes" : "Add class"}
        </button>
      </div>
    </form>
  );
}
