"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/context/SupabaseAuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const LENGTHS = [1, 2, 3, 4] as const;

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const atLocal = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

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
  const [date, setDate] = useState(initialDate || todayKey());
  const [startTime, setStartTime] = useState("08:00");
  const [hours, setHours] = useState<(typeof LENGTHS)[number]>(3);
  const [weeks, setWeeks] = useState<1 | 4>(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !room.trim() || !date || !startTime) {
      setError("Add the subject, room, day, and start time.");
      return;
    }

    const firstStart = atLocal(date, startTime);
    if (Number.isNaN(firstStart.getTime())) {
      setError("That day or time is not valid.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const rows = Array.from({ length: weeks }, (_, week) => {
      const start = new Date(firstStart);
      start.setDate(start.getDate() + week * 7);
      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
      return {
        subject: subject.trim(),
        room: room.trim(),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
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
    onCreated?.();
  };

  return (
    <form onSubmit={onSubmit} className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Add a class</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Subject, room, and a start time. The length fills in the end.
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--muted)]">
            Close
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
            Subject
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Community Health"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="room" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
              Room
            </label>
            <input
              id="room"
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              placeholder="Room 203"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
          <div>
            <label htmlFor="class-date" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
              Day
            </label>
            <input
              id="class-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="start-time" className="mb-2 block text-sm font-semibold text-[var(--ink)]">
            Starts
          </label>
          <input
            id="start-time"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-base text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:max-w-xs"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Length</p>
          <div className="grid grid-cols-4 gap-2">
            {LENGTHS.map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => setHours(length)}
                className={`min-h-11 rounded-xl px-1 text-sm font-semibold ${
                  hours === length
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--line)] bg-[var(--quiet)] text-[var(--ink)]"
                }`}
              >
                {length} hour{length === 1 ? "" : "s"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Repeat</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWeeks(1)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                weeks === 1 ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-[var(--quiet)] text-[var(--ink)]"
              }`}
            >
              This day
            </button>
            <button
              type="button"
              onClick={() => setWeeks(4)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
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
