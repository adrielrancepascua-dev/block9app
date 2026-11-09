"use client";

import React, { useEffect, useState } from "react";
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
  const hour = value.length >= 2 ? value.slice(0, 2) : "";
  const minute = value.length >= 5 ? value.slice(3, 5) : "";

  useEffect(() => {
    if (!value) setPendingHour("");
  }, [value]);

  const shownHour = hour || pendingHour;

  const chooseHour = (nextHour: string) => {
    setPendingHour(nextHour);
    onChange(nextHour && minute ? `${nextHour}:${minute}` : "");
  };

  const chooseMinute = (nextMinute: string) => {
    if (!shownHour || !nextMinute) {
      onChange("");
      return;
    }
    onChange(`${shownHour}:${nextMinute}`);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <select id={id} value={shownHour} onChange={(event) => chooseHour(event.target.value)} className={fieldClass}>
        <option value="">Hour</option>
        {HOURS.map((item) => (
          <option key={item} value={String(item).padStart(2, "0")}>
            {hourLabel(item)}
          </option>
        ))}
      </select>
      <select
        aria-label={`${id} minutes`}
        value={minute}
        onChange={(event) => chooseMinute(event.target.value)}
        className={fieldClass}
      >
        <option value="">Min</option>
        {MINUTES.map((item) => (
          <option key={item} value={String(item).padStart(2, "0")}>
            :{String(item).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_45%,transparent)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export default function AdminPanel({
  initialDate,
  onCreated,
  onClose,
}: {
  initialDate?: string;
  onCreated?: () => void;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(initialDate || "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [weeks, setWeeks] = useState<1 | 4>(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDate(initialDate || "");
    setSubject("");
    setRoom("");
    setStartTime("");
    setEndTime("");
    setError("");
  }, [initialDate]);

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
    <form onSubmit={onSubmit} className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] sm:p-6">
      <div className="sticky top-0 z-10 mb-5 flex items-start justify-between gap-4 bg-[var(--surface)] pb-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Add a class</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Leave the end time empty when dismissal is not set yet.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--quiet)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
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

        {error ? <p className="text-sm text-[#9f2d3a]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#2460ad] active:scale-[0.98] disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Adding" : weeks === 4 ? "Add 4 classes" : "Add class"}
        </button>
      </div>
    </form>
  );
}
