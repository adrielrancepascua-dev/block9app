"use client";

import React, { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import AdminPanel from "@/components/AdminPanel";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Trash2, Clock, MapPin } from "lucide-react";
import AppLoading from "@/components/AppLoading";

interface Schedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
}

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      redirect("/");
    }
  }, [profile, loading]);

  // Fetch all schedules
  useEffect(() => {
    if (profile?.role === "admin") {
      fetchSchedules();
    }
  }, [profile]);

  const fetchSchedules = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("start_time", { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err: any) {
      console.error("Error fetching schedules:", err.message);
      toast.error("Failed to load schedules");
    } finally {
      setIsFetching(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    setDeleting(scheduleId);
    try {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;

      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      toast.success("Schedule deleted successfully");
    } catch (err: any) {
      console.error("Error deleting schedule:", err.message);
      toast.error("Failed to delete schedule");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <AppLoading />
    );
  }

  return (
    <ProfileLayout>
      <div className="w-full space-y-6 sm:space-y-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-[1.85rem] font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Classes
          </h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-[var(--muted)]">
            Add a class in a few taps. Everyone sees it on the calendar.
          </p>
        </div>

        {/* Add Schedule Form */}
        <AdminPanel />

        {/* Existing Schedules List */}
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
              On the calendar
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {schedules.length === 0
                ? "No schedules created yet."
                : `Showing ${schedules.length} schedule${
                    schedules.length !== 1 ? "s" : ""
                  }`}
            </p>
          </div>

          {isFetching ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-blue-500"></div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-8 text-center text-[var(--muted)]">
              No classes yet. Add the first one above.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {schedules.map((schedule) => {
                const formattedStart = new Date(
                  schedule.start_time
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const formattedEnd = new Date(schedule.end_time).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                );
                const scheduleDate = new Date(schedule.start_time).toLocaleDateString(
                  undefined,
                  { weekday: "short", year: "numeric", month: "short", day: "numeric" }
                );

                return (
                  <div
                    key={schedule.id}
                    className="relative flex flex-col gap-4 rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)]"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      disabled={deleting === schedule.id}
                      className="absolute right-4 top-4 rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--quiet)] hover:text-[#9f2d3a] disabled:opacity-50"
                      title="Delete Schedule"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {/* Subject */}
                    <div>
                      <h3 className="pr-10 text-xl font-semibold text-[var(--ink)]">
                        {schedule.subject}
                      </h3>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col gap-2 text-sm text-[var(--muted)]">
                      <div>
                        <p className="font-medium text-[var(--muted)]">
                          Date
                        </p>
                        <p>{scheduleDate}</p>
                      </div>

                      {/* Time with Icon */}
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span>
                          {formattedStart} - {formattedEnd}
                        </span>
                      </div>

                      {/* Room with Icon */}
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-red-500" />
                        <span>{schedule.room}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProfileLayout>
  );
}
