"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import AdminPanel from "@/components/AdminPanel";
import DayClassSheet, { type SheetPhase } from "@/components/DayClassSheet";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import AppLoading from "@/components/AppLoading";

interface Schedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string | null;
}

interface DayCell {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const buildMonthGrid = (year: number, month: number): DayCell[] => {
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return {
      key: toDateKey(day),
      date: day,
      inCurrentMonth: day.getMonth() === month,
    };
  });
};

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ key: string; dateLabel: string; schedules: Schedule[] } | null>(null);
  const [sheetPhase, setSheetPhase] = useState<SheetPhase>("closed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [overlayReady, setOverlayReady] = useState(false);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    setOverlayReady(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchSchedules();
    }
  }, [user]);

  const fetchSchedules = async () => {
    setIsFetching(true);
    setFetchError(null);

    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedules")
        .select("id, subject, room, start_time, end_time")
        .order("start_time", { ascending: true });

      if (scheduleError) throw scheduleError;

      setSchedules(scheduleData || []);
    } catch (err: any) {
      console.error("Error fetching schedules:", err.message);
      setFetchError("Could not refresh schedules right now. Retrying automatically...");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const handleRefetch = () => {
      fetchSchedules();
    };

    const intervalId = setInterval(handleRefetch, 60000);
    window.addEventListener("focus", handleRefetch);
    window.addEventListener("online", handleRefetch);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleRefetch);
      window.removeEventListener("online", handleRefetch);
    };
  }, [user]);

  const monthGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const schedulesByDay = useMemo(() => {
    const grouped: Record<string, Schedule[]> = {};

    schedules.forEach((schedule) => {
      const d = new Date(schedule.start_time);
      if (Number.isNaN(d.getTime())) return;
      const key = toDateKey(d);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(schedule);
    });

    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    });

    return grouped;
  }, [schedules]);

  const monthTitle = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const goToPreviousMonth = () => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const goToNextMonth = () => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const removeSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", scheduleId);
    if (error) {
      toast.error("Could not delete that class.");
      return;
    }
    setSchedules((current) => current.filter((item) => item.id !== scheduleId));
    setSelectedDay((current) =>
      current
        ? { ...current, schedules: current.schedules.filter((item) => item.id !== scheduleId) }
        : current
    );
    toast.success("Class deleted.");
  };

  const openDay = (cell: DayCell) => {
    setSelectedDay({
      key: cell.key,
      dateLabel: cell.date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      schedules: schedulesByDay[cell.key] || [],
    });
    setSheetPhase("peek");
  };

  if (loading) {
    return (
      <AppLoading />
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Redirecting to login...
      </div>
    );
  }

  return (
    <ProfileLayout surface="paper">
      <div className="w-full">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
              Hi, {profile?.name || "Student"}
            </h1>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Tap a day. Swipe the preview up for the room and the time.
            </p>
          </div>

          {profile?.role === "admin" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setComposerOpen(true);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2460ad] active:scale-[0.98]"
              >
                Add a class
              </button>
            </div>
          ) : null}
        </div>

        {fetchError && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {fetchError}
          </div>
        )}

        <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_1px_2px_rgba(20,32,51,0.04)] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--quiet)] px-3 text-sm font-semibold text-[var(--ink)]"
            >
              Prev
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{monthTitle}</h2>
              <button type="button" onClick={goToCurrentMonth} className="text-xs font-semibold text-[var(--accent-text)]">
                Today
              </button>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--quiet)] px-3 text-sm font-semibold text-[var(--ink)]"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-1 pb-2 text-center text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)]"
              >
                {weekday.toUpperCase()}
              </div>
            ))}

            {monthGrid.map((cell) => {
              const daySchedules = schedulesByDay[cell.key] || [];
              const isToday = toDateKey(cell.date) === toDateKey(new Date());
              const hasClasses = daySchedules.length > 0;
              const selected = selectedDay?.key === cell.key && sheetPhase !== "closed";

              return (
                <button
                  type="button"
                  key={cell.key}
                  onClick={() => openDay(cell)}
                  aria-label={
                    hasClasses
                      ? `${cell.date.getDate()}, ${daySchedules.length} class${daySchedules.length === 1 ? "" : "es"}`
                      : String(cell.date.getDate())
                  }
                  className="flex h-12 flex-col items-center justify-center"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold ${
                      isToday || hasClasses
                        ? "bg-[var(--accent)] text-white"
                        : cell.inCurrentMonth
                        ? "text-[var(--ink)]"
                        : "text-[#9aa6b2]"
                    } ${isToday ? "ring-2 ring-[var(--ink)]" : ""} ${
                      selected ? "ring-2 ring-[var(--accent-text)] ring-offset-2 ring-offset-[var(--surface)]" : ""
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {hasClasses
                      ? daySchedules.slice(0, 3).map((schedule) => (
                          <span key={schedule.id} className="h-1.5 w-1.5 rounded-full bg-[var(--accent-text)]" />
                        ))
                      : null}
                  </span>
                </button>
              );
            })}
          </div>

          {!isFetching && schedules.length === 0 && (
            <p className="mt-3 text-center text-sm text-[var(--muted)]">No classes this month.</p>
          )}

          {isFetching && (
            <div className="mt-4 flex justify-center py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-blue-500" />
            </div>
          )}
        </div>
      </div>

      {overlayReady && selectedDay
        ? createPortal(
            <DayClassSheet
              phase={sheetPhase}
              dateLabel={selectedDay.dateLabel}
              classes={selectedDay.schedules}
              onClose={() => setSheetPhase("closed")}
              onExpand={() => setSheetPhase("expanded")}
              onCollapse={() => setSheetPhase("peek")}
              canManage={profile?.role === "admin"}
              onEdit={(item) => {
                setEditingSchedule(item);
                setSheetPhase("closed");
                setComposerOpen(true);
              }}
              onDelete={(item) => void removeSchedule(item.id)}
            />,
            document.body
          )
        : null}

      {overlayReady && composerOpen
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#142033]/50 sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Close the class form"
                onClick={() => {
                  setComposerOpen(false);
                  setEditingSchedule(null);
                }}
              />
              <div className="relative z-10 max-h-[min(92dvh,760px)] w-full max-w-lg overflow-y-auto">
                <AdminPanel
                  key={editingSchedule?.id ?? "new"}
                  schedule={editingSchedule}
                  onClose={() => {
                    setComposerOpen(false);
                    setEditingSchedule(null);
                  }}
                  onCreated={() => {
                    setComposerOpen(false);
                    setEditingSchedule(null);
                    fetchSchedules();
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </ProfileLayout>
  );
}