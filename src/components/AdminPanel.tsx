"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState<"hour" | "minute" | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hour = value.length >= 2 ? value.slice(0, 2) : "";
  const minute = value.length >= 5 ? value.slice(3, 5) : "";
  const shownHour = hour || pendingHour;

  useEffect(() => {
    if (!value) setPendingHour("");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [open]);

  const chooseHour = (nextHour: string) => {
    setPendingHour(nextHour);
    onChange(nextHour && minute ? `${nextHour}:${minute}` : "");
    setOpen(minute ? null : "minute");
  };

  const chooseMinute = (nextMinute: string) => {
    if (!shownHour) {
      setOpen("hour");
      return;
    }
    onChange(`${shownHour}:${nextMinute}`);
    setOpen(null);
  };

  const choiceClass = (active: boolean) =>
    `min-h-11 whitespace-nowrap rounded-xl border px-1 text-sm font-semibold tabular-nums ${
      active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
    }`;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={choiceClass(open === "hour")} onClick={() => setOpen(open === "hour" ? null : "hour")}>
          {shownHour ? hourLabel(Number(shownHour)) : "Hour"}
        </button>
        <button
          type="button"
          id={id}
          className={choiceClass(open === "minute")}
          onClick={() => setOpen(open === "minute" ? null : "minute")}
        >
          {minute || "Min"}
        </button>
      </div>
      {open === "hour" ? (
        <div ref={panelRef} className="mt-2 grid grid-cols-4 gap-2" style={{ scrollMarginBottom: "6.5rem" }}>
          {HOURS.map((item) => {
            const key = String(item).padStart(2, "0");
            return (
              <button key={key} type="button" onClick={() => chooseHour(key)} className={choiceClass(shownHour === key)}>
                {hourLabel(item)}
              </button>
            );
          })}
        </div>
      ) : null}
      {open === "minute" ? (
        <div ref={panelRef} className="mt-2 grid grid-cols-4 gap-2" style={{ scrollMarginBottom: "6.5rem" }}>
          {MINUTES.map((item) => {
            const key = String(item).padStart(2, "0");
            return (
              <button key={key} type="button" onClick={() => chooseMinute(key)} className={`${choiceClass(minute === key)} tabular-nums`}>
                {key}
              </button>
            );
          })}
        </div>
      ) : null}
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

  useEffect(() => {
    if (schedule) return;
    setDate(initialDate || "");
  }, [initialDate, schedule]);

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
