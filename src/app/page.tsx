"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/SupabaseAuthContext";
import ProfileLayout from "@/components/ProfileLayout";
import { supabase } from "@/utils/supabase";
import ScheduleCard from "@/components/ScheduleCard";

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

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, "going" | "late" | "absent" | null>
  >({});
  const [attendanceSummary, setAttendanceSummary] = useState<
    Record<string, AttendanceSummary>
  >({});
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsFetching(true);
    try {
      // Removing startOfDay filter so schedules don't mysteriously vanish 
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedules")
        .select("*")
        .order("start_time", { ascending: true });

      if (scheduleError) throw scheduleError;
      setSchedules(scheduleData || []);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("schedule_id, status, user_id, profiles(name)")
        .in(
          "schedule_id",
          (scheduleData || []).map((schedule) => schedule.id)
        );

      if (attendanceError) throw attendanceError;

      const attendanceMap: Record<
        string,
        "going" | "late" | "absent" | null
      > = {};
      const attendanceSummaryMap: Record<string, AttendanceSummary> = {};

      attendanceData?.forEach((record: any) => {
        const status = record.status as "going" | "late" | "absent";
        const displayName =
          record.user_id === user?.id ? "You" : record.profiles?.name || "Guest";

        if (record.user_id === user?.id) {
          attendanceMap[record.schedule_id] = status;
        }

        if (!attendanceSummaryMap[record.schedule_id]) {
          attendanceSummaryMap[record.schedule_id] = {
            going: [],
            late: [],
            absent: [],
          };
        }

        attendanceSummaryMap[record.schedule_id][status].push(displayName);
      });

      setAttendance(attendanceMap);
      setAttendanceSummary(attendanceSummaryMap);
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err.message);
    } finally {
      setIsFetching(false);
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading...
      </div>
    );
  }

  return (
    <ProfileLayout>
      <div className="w-full">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 drop-shadow-md dark:text-white">
              Hi, {profile?.name || "Student"} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
              Here are your upcoming schedules.
            </p>
          </div>

          <div className="space-x-3">
            {profile?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
              >
                Manage Schedules
              </button>
            )}
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-300 bg-transparent px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isFetching ? (
            <div className="flex py-12 justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-blue-500"></div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white/50 p-8 text-center text-slate-700 backdrop-blur-md dark:border-white/20 dark:bg-white/5 dark:text-white">
              No classes today - enjoy the rest!
            </div>
          ) : (
            schedules.map((sched) => (
              <ScheduleCard
                key={sched.id}
                id={sched.id}
                subject={sched.subject}
                room={sched.room}
                start_time={sched.start_time}
                end_time={sched.end_time}
                initialStatus={attendance[sched.id] || null}
                attendanceSummary={attendanceSummary[sched.id] || null}
              />
            ))
          )}
        </div>
      </div>
    </ProfileLayout>
  );
}

