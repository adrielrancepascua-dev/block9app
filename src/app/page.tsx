"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import { supabase } from "@/utils/supabase";
import { CalendarDays, Clock3, MapPin, X } from "lucide-react";

interface Schedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
}

interface AttendanceSummary {
  going: string[];
  late: string[];
  absent: string[];
}

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

const formatTime = (timeStr?: string) => {
  if (!timeStr) return "TBA";
  const d = new Date(timeStr);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const [attendanceSummaryMap, setAttendanceSummaryMap] = useState<Record<string, AttendanceSummary>>({});
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    dateLabel: string;
    schedules: Schedule[];
  } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

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
      });

      setAttendanceSummaryMap(summaryMap);
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
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
    <ProfileLayout>
      <div className="w-full font-[family-name:var(--font-geist-sans)]">
        <div className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 drop-shadow-md sm:text-3xl dark:text-white">
              Hi, {profile?.name || "Student"}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
              Tap or click a schedule to view room, time, and attendance status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
              >
                Manage Schedules
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
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

        <div className="rounded-xl border border-slate-300/70 bg-white/80 p-3 shadow-lg backdrop-blur-md dark:border-white/20 dark:bg-slate-900/70 sm:p-4">
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mb-6">
            <div className="flex items-center gap-2 justify-self-start">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={goToCurrentMonth}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Today
              </button>
            </div>

            <h2 className="px-2 text-center text-xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {monthTitle}
            </h2>

            <div className="justify-self-end">
              <button
                type="button"
                onClick={goToNextMonth}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border border-slate-300/70 dark:border-white/15">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="min-h-9 border-b border-r border-slate-300/55 bg-slate-100/90 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:min-h-11 sm:px-2 sm:text-xs"
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
                  className={`min-h-24 border-b border-r border-slate-300/50 p-1.5 sm:min-h-32 sm:p-2 ${
                    isLastCol ? "border-r-0" : ""
                  } ${cell.inCurrentMonth ? "bg-white/70 dark:bg-slate-900/35" : "bg-slate-100/75 dark:bg-slate-900/15"} dark:border-white/10`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold sm:h-7 sm:min-w-7 ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : cell.inCurrentMonth
                          ? "text-slate-700 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500"
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
                        className="w-full rounded-sm border border-emerald-400/35 bg-emerald-600/75 px-1.5 py-1 text-center text-[10px] font-semibold text-emerald-50 shadow-sm backdrop-blur-md transition hover:bg-emerald-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 sm:hidden"
                      >
                        {daySchedules.length} event{daySchedules.length > 1 ? "s" : ""}
                      </button>
                    )}

                    <div className="hidden space-y-1 sm:block">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => setSelectedSchedule(schedule)}
                          className="w-full overflow-hidden rounded-sm border border-emerald-400/35 bg-emerald-600/75 px-2 py-1 text-left text-xs font-semibold text-emerald-50 shadow-sm backdrop-blur-md transition hover:bg-emerald-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          title={`${schedule.subject} (${formatTime(schedule.start_time)} - ${formatTime(
                            schedule.end_time
                          )})`}
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
            <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-6 text-center text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              No schedules yet for this month.
            </div>
          )}

          {isFetching && (
            <div className="mt-4 flex justify-center py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-blue-500" />
            </div>
          )}
        </div>
      </div>

      {selectedDayEvents && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6"
          onClick={() => setSelectedDayEvents(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedDayEvents.dateLabel}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Select an event to view full details.</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="w-full rounded-md border border-emerald-400/35 bg-emerald-600/75 p-3 text-left text-emerald-50 shadow-sm backdrop-blur-md transition hover:bg-emerald-600/90"
                >
                  <p className="text-sm font-bold">{schedule.subject}</p>
                  <p className="mt-0.5 text-xs text-emerald-100/90">
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6"
          onClick={() => setSelectedSchedule(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="pr-2 text-xl font-bold text-slate-900 dark:text-white">{selectedSchedule.subject}</h3>
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
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
                {formatTime(selectedSchedule.start_time)} - {formatTime(selectedSchedule.end_time)}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-500" />
                Room {selectedSchedule.room || "TBA"}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Attendance Status
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
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
        </div>
      )}
    </ProfileLayout>
  );
}