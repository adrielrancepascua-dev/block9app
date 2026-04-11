"use client";

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Clock, MapPin, Trash2 } from 'lucide-react';
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
}

export default function ScheduleCard({
  id,
  subject,
  room,
  start_time,
  end_time,
  initialStatus,
}: ScheduleCardProps) {
  const { user, profile } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  // Format the times to strings like "09:00 AM"
  const formattedStart = new Date(start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedEnd = new Date(end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

          <div className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:gap-6">
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
