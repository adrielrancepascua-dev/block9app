"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import AdminPanel from "@/components/AdminPanel";
import AttendanceToggle, { type AttendanceStatus } from "@/components/AttendanceToggle";
import { supabase } from "@/utils/supabase";
import { CalendarDays, Clock3, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import AppLoading from "@/components/AppLoading";

interface Schedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string | null;
}

interface AttendanceSummary {
  going: string[];
  late: string[];
  absent: string[];
}

type AttendanceSummaryMap = Record<string, AttendanceSummary>;
type MyAttendanceMap = Record<string, AttendanceStatus>;

interface DayCell {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusMeta = {
  going: {
    label: "Going",
    dotClass: "bg-emerald-500",
    panelClass: "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-500/10",
  },
  late: {
    label: "Late",
    dotClass: "bg-amber-500",
    panelClass: "border-amber-200/80 bg-amber-50/70 dark:border-amber-400/25 dark:bg-amber-500/10",
  },
  absent: {
    label: "Absent",
    dotClass: "bg-rose-500",
    panelClass: "border-rose-200/80 bg-rose-50/70 dark:border-rose-400/25 dark:bg-rose-500/10",
  },
} as const;

const emptySummary: AttendanceSummary = {
  going: [],
  late: [],
  absent: [],
};

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const formatTime = (timeStr?: string | null) => {
  if (!timeStr) return "";
  const d = new Date(timeStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatSpan = (start?: string | null, end?: string | null) => {
  const startLabel = formatTime(start);
  const endLabel = formatTime(end);
  if (!endLabel) return startLabel || "Time not set";
  return `${startLabel} - ${endLabel}`;
};

const formatDate = (timeStr?: string) => {
  if (!timeStr) return "TBA";
  const d = new Date(timeStr);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const renderNames = (names: string[]) => {
  if (!names.length) return "None yet";
  if (names.length <= 5) return names.join(", ");
  return `${names.slice(0, 5).join(", ")} +${names.length - 5}`;
};

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
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendanceSummaryMap, setAttendanceSummaryMap] = useState<AttendanceSummaryMap>({});
  const [myAttendanceMap, setMyAttendanceMap] = useState<MyAttendanceMap>({});
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    dateLabel: string;
    schedules: Schedule[];
  } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
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

      const safeSchedules = scheduleData || [];
      setSchedules(safeSchedules);

      if (!safeSchedules.length) {
        setAttendanceSummaryMap({});
        return;
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("schedule_id, status, user_id, profiles(name)")
        .in(
          "schedule_id",
          safeSchedules.map((schedule) => schedule.id)
        );

      if (attendanceError) throw attendanceError;

      const summaryMap: Record<string, AttendanceSummary> = {};
      const currentUserStatusMap: MyAttendanceMap = {};
      (attendanceData || []).forEach((record: any) => {
        const status = record.status as keyof AttendanceSummary;
        if (!["going", "late", "absent"].includes(status)) return;

        if (!summaryMap[record.schedule_id]) {
          summaryMap[record.schedule_id] = {
            going: [],
            late: [],
            absent: [],
          };
        }

        const displayName = record.user_id === user?.id ? "You" : record.profiles?.name || "Guest";
        summaryMap[record.schedule_id][status].push(displayName);

        if (record.user_id === user?.id) {
          currentUserStatusMap[record.schedule_id] = status as AttendanceStatus;
        }
      });

      setAttendanceSummaryMap(summaryMap);
      setMyAttendanceMap(currentUserStatusMap);
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

  const selectedAttendance = selectedSchedule
    ? attendanceSummaryMap[selectedSchedule.id] || emptySummary
    : emptySummary;
  const selectedCurrentStatus = selectedSchedule
    ? myAttendanceMap[selectedSchedule.id] || null
    : null;

  const applyLocalAttendanceChange = (
    scheduleId: string,
    newStatus: AttendanceStatus,
    previousStatus: AttendanceStatus,
    displayName: string
  ) => {
    setAttendanceSummaryMap((prev) => {
      const existingSummary = prev[scheduleId] || emptySummary;
      const nextSummary: AttendanceSummary = {
        going: existingSummary.going.filter((name) => name !== displayName),
        late: existingSummary.late.filter((name) => name !== displayName),
        absent: existingSummary.absent.filter((name) => name !== displayName),
      };

      if (newStatus) {
        nextSummary[newStatus] = [...nextSummary[newStatus], displayName];
      }

      return {
        ...prev,
        [scheduleId]: nextSummary,
      };
    });

    setMyAttendanceMap((prev) => {
      const nextMap = { ...prev };
      if (newStatus) {
        nextMap[scheduleId] = newStatus;
      } else {
        delete nextMap[scheduleId];
      }
      return nextMap;
    });
  };

  const handleStatusChange = async (scheduleId: string, newStatus: NonNullable<AttendanceStatus>) => {
    if (!user || isUpdatingStatus) return;

    const previousStatus = myAttendanceMap[scheduleId] || null;
    const displayName = "You";

    setIsUpdatingStatus(true);
    applyLocalAttendanceChange(scheduleId, newStatus, previousStatus, displayName);

    try {
      const { error } = await supabase.from("attendance").upsert(
        {
          user_id: user.id,
          schedule_id: scheduleId,
          status: newStatus,
        },
        {
          onConflict: "user_id,schedule_id",
        }
      );

      if (error) throw error;

      toast.success(`Attendance marked as ${newStatus}`);
    } catch (err: any) {
      console.error("Failed to update attendance:", err?.message || err);
      applyLocalAttendanceChange(scheduleId, previousStatus, newStatus, displayName);
      toast.error("Failed to update attendance. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

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

  const openDayEvents = (daySchedules: Schedule[], dayDate: Date) => {
    if (!daySchedules.length) return;

    if (daySchedules.length === 1) {
      setSelectedSchedule(daySchedules[0]);
      return;
    }

    setSelectedDayEvents({
      dateLabel: dayDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      schedules: daySchedules,
    });
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
              Tap a day to see the room, the time, and who is going.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile?.role === "admin" && (
              <>
                <button
                  onClick={() => setComposerOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2460ad] active:scale-[0.98]"
                >
                  Add a class
                </button>
                <button
                  onClick={() => router.push("/admin")}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--quiet)] active:scale-[0.98]"
                >
                  All classes
                </button>
              </>
            )}
            <button
              onClick={signOut}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--quiet)] active:scale-[0.98]"
            >
              Sign out
            </button>
          </div>
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

          <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[var(--line)]">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="border-b border-r border-[var(--line)] bg-[var(--quiet)] px-1 py-1.5 text-center text-[11px] font-semibold text-[#5c6b7a] last:border-r-0 sm:text-xs"
              >
                {weekday}
              </div>
            ))}

            {monthGrid.map((cell, index) => {
              const isLastCol = index % 7 === 6;
              const daySchedules = schedulesByDay[cell.key] || [];
              const isToday = toDateKey(cell.date) === toDateKey(new Date());

              return (
                <div
                  key={cell.key}
                  className={`min-h-10 border-b border-r border-[var(--line)] p-1 sm:min-h-24 sm:p-2 ${
                    isLastCol ? "border-r-0" : ""
                  } ${cell.inCurrentMonth ? "bg-[var(--surface)]" : "bg-[var(--quiet)]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                        isToday
                          ? "bg-[var(--accent)] text-white"
                          : cell.inCurrentMonth
                          ? "text-[var(--ink)]"
                          : "text-[#9aa6b2]"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {daySchedules.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openDayEvents(daySchedules, cell.date)}
                        aria-label={`${daySchedules.length} event${daySchedules.length > 1 ? "s" : ""}`}
                        className="mt-0.5 w-full rounded-md bg-[var(--accent)] px-1 py-0.5 text-center text-[11px] font-bold text-white sm:hidden"
                      >
                        <span>{daySchedules.length}</span>
                      </button>
                    )}

                    <div className="hidden space-y-1 sm:block">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => setSelectedSchedule(schedule)}
                          className="w-full overflow-hidden rounded-md border border-sky-200/35 bg-[var(--accent)] px-2 py-1 text-left text-xs font-semibold text-white shadow-sm transition hover:bg-[#2460ad] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70"
                          title={`${schedule.subject} (${formatSpan(schedule.start_time, schedule.end_time)})`}
                        >
                          <span className="truncate">{schedule.subject}</span>
                        </button>
                      ))}

                      {daySchedules.length > 3 && (
                        <p className="px-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          +{daySchedules.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
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

      {overlayReady && selectedDayEvents
        ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 pb-[calc(5.2rem+env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => setSelectedDayEvents(null)}
        >
          <div
            className="w-full max-w-lg rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedDayEvents.dateLabel}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Select an event to view full details.</p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--quiet)]"
                onClick={() => setSelectedDayEvents(null)}
                aria-label="Close day events"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedDayEvents.schedules.map((schedule) => (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => {
                    setSelectedDayEvents(null);
                    setSelectedSchedule(schedule);
                  }}
                  className="w-full rounded-md border border-sky-200/35 bg-[var(--accent)] p-3 text-left text-white shadow-sm transition hover:bg-[#2460ad]"
                >
                  <p className="text-sm font-bold">{schedule.subject}</p>
                  <p className="mt-0.5 text-xs text-sky-100/90">
                    {formatSpan(schedule.start_time, schedule.end_time)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
        : null}

      {overlayReady && selectedSchedule
        ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => setSelectedSchedule(null)}
        >
          <div
            className="max-h-[min(88dvh,760px)] w-full max-w-lg overflow-y-auto rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="pr-2 text-xl font-bold text-slate-900 dark:text-white">{selectedSchedule.subject}</h3>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--quiet)]"
                onClick={() => setSelectedSchedule(null)}
                aria-label="Close schedule details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                {formatDate(selectedSchedule.start_time)}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-600" />
                {formatSpan(selectedSchedule.start_time, selectedSchedule.end_time)}
                {!selectedSchedule.end_time ? " · Dismissal not set" : ""}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-500" />
                Room {selectedSchedule.room || "TBA"}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--quiet)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Attendance Status
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your current status: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedCurrentStatus || "none"}</span>
                </p>
              </div>

              <div className="mt-3">
                <AttendanceToggle
                  scheduleId={selectedSchedule?.id || ""}
                  currentStatus={selectedCurrentStatus}
                  onStatusChange={handleStatusChange}
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((status) => {
                  const names = selectedAttendance[status];
                  return (
                    <div
                      key={status}
                      className={`rounded-md border p-2 text-xs ${statusMeta[status].panelClass}`}
                    >
                      <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-100">
                        <span className={`h-2 w-2 rounded-full ${statusMeta[status].dotClass}`} />
                        {statusMeta[status].label} ({names.length})
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{renderNames(names)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
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
                onClick={() => setComposerOpen(false)}
              />
              <div className="relative z-10 max-h-[min(92dvh,760px)] w-full max-w-lg overflow-y-auto">
                <AdminPanel
                  onClose={() => setComposerOpen(false)}
                  onCreated={() => {
                    setComposerOpen(false);
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