"use client";

import React, { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import AdminPanel from "@/components/AdminPanel";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Trash2, Clock, MapPin } from "lucide-react";

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  return (
    <ProfileLayout>
      <div className="w-full space-y-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 drop-shadow-md dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            Manage schedules, create classes, and monitor attendance.
          </p>
        </div>

        {/* Add Schedule Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <AdminPanel />
        </div>

        {/* Existing Schedules List */}
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              All Schedules
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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
            <div className="rounded-xl border border-slate-200 bg-white/50 p-8 text-center text-slate-700 backdrop-blur-md dark:border-white/20 dark:bg-white/5 dark:text-white">
              No schedules yet. Create one using the form above.
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
                    className="relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur-md transition hover:bg-white dark:border-white/20 dark:bg-slate-900/80 dark:hover:bg-slate-900"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      disabled={deleting === schedule.id}
                      className="absolute right-4 top-4 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      title="Delete Schedule"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {/* Subject */}
                    <div>
                      <h3 className="pr-10 text-xl font-bold text-slate-900 dark:text-white">
                        {schedule.subject}
                      </h3>
                    </div>

                    {/* Details */}
                    <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                      {/* Date */}
                      <div>
                        <p className="font-medium text-slate-500 dark:text-slate-400">
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
