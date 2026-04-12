"use client";

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { CalendarDays, Clock, MapPin, Trash2 } from 'lucide-react';
import AttendanceToggle, { AttendanceStatus } from './AttendanceToggle';
import { useAuth } from '@/context/SupabaseAuthContext';
import { toast } from 'sonner';

export interface ScheduleCardProps {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  initialStatus: AttendanceStatus;
  attendanceSummary?: {
    going: string[];
    late: string[];
    absent: string[];
  } | null;
}

const statusMeta = {
  going: {
    label: 'Going',
    barClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  late: {
    label: 'Late',
    barClass: 'bg-amber-500',
    dotClass: 'bg-amber-500',
  },
  absent: {
    label: 'Absent',
    barClass: 'bg-rose-500',
    dotClass: 'bg-rose-500',
  },
} as const;

export default function ScheduleCard({
  id,
  subject,
  room,
  start_time,
  end_time,
  initialStatus,
  attendanceSummary,
}: ScheduleCardProps) {
  const { user, profile } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  // Format the times to strings like "09:00 AM" safely
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBA';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return 'TBA';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedStart = formatTime(start_time);
  const formattedEnd = formatTime(end_time);
  const formattedDate = (() => {
    const d = new Date(start_time);
    if (Number.isNaN(d.getTime())) return 'TBA';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  })();

  const attendanceGroups = attendanceSummary || {
    going: [],
    late: [],
    absent: [],
  };

  const totalResponses =
    attendanceGroups.going.length +
    attendanceGroups.late.length +
    attendanceGroups.absent.length;

  const renderNames = (names: string[]) => {
    if (names.length === 0) return 'None yet';
    const visibleNames = names.slice(0, 3);
    const extraCount = names.length - visibleNames.length;
    return `${visibleNames.join(', ')}${extraCount > 0 ? ` +${extraCount}` : ''}`;
  };

  // Handle the status update when the toggle is clicked
  const handleStatusChange = async (scheduleId: string, newStatus: NonNullable<AttendanceStatus>) => {
    if (!user) return;
    
    // Optimistic UI update
    setCurrentStatus(newStatus);
    setIsUpdating(true);

    try {
      // Upsert the attendance status directly to Supabase
      const { error } = await supabase
        .from('attendance')
        .upsert({
          user_id: user.id,
          schedule_id: scheduleId,
          status: newStatus,
        }, {
           onConflict: 'user_id,schedule_id' // Based on the UNIQUE(user_id, schedule_id) constraint in your schema
        });

      if (error) {
        throw error;
      }
      
      toast.success(`Attendance marked as ${newStatus} for ${subject}`);
    } catch (error) {
      console.error('Failed to update attendance:', error);
      toast.error('Failed to update attendance. Please try again.');
      // Revert if the network request fails
      setCurrentStatus(initialStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur-md transition hover:bg-white dark:border-white/20 dark:bg-slate-900/80 dark:hover:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Left Side: Details */}
        <div className="flex-1">
          <div className="flex items-start justify-between sm:justify-start sm:gap-4 mb-2">
            {/* Large Bold Subject */}
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {subject}
            </h2>
            {profile?.role === 'admin' && (
              <button 
                onClick={async () => {
                  if(confirm('Are you sure you want to delete this schedule?')) {
                     const { error } = await supabase.from('schedules').delete().eq('id', id);
                     if (error) toast.error('Failed to delete schedule');
                     else toast.success('Schedule deleted! Please refresh the page.');
                  }
                }}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition"
                title="Delete Schedule"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              <span>{formattedDate}</span>
            </div>

            {/* Time with Lucide Clock Icon */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>
                {formattedStart} - {formattedEnd}
              </span>
            </div>
            
            {/* Room with Lucide MapPin Icon */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-red-500" />
              <span>{room}</span>
            </div>
          </div>

          {/* Attendance Checklist Bar */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Attendance Checklist</span>
              <span>{totalResponses} responses</span>
            </div>

            <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              {totalResponses === 0 ? (
                <div className="h-full w-full bg-slate-300 dark:bg-slate-600" />
              ) : (
                (Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((status) => {
                  const count = attendanceGroups[status].length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={status}
                      className={statusMeta[status].barClass}
                      style={{ width: `${(count / totalResponses) * 100}%` }}
                      title={`${statusMeta[status].label}: ${attendanceGroups[status].join(', ')}`}
                    />
                  );
                })
              )}
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              {(Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((status) => {
                const names = attendanceGroups[status];
                return (
                  <div
                    key={status}
                    className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-white/10 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[status].dotClass}`} />
                      {statusMeta[status].label} <span className="text-slate-500">({names.length})</span>
                    </div>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {renderNames(names)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Toggle Switch */}
        <div className="mt-4 flex flex-col items-start sm:mt-0 sm:items-end">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isUpdating ? 'Saving...' : 'Your Status'}
          </p>
          <div className="opacity-100 transition-opacity aria-disabled:opacity-50" aria-disabled={isUpdating}>
            <AttendanceToggle
              scheduleId={id}
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}
