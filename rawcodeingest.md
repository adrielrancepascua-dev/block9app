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

  // Format the times to strings like "09:00 AM" safely
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBA';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return 'TBA';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedStart = formatTime(start_time);
  const formattedEnd = formatTime(end_time);

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
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/SupabaseAuthContext';
import { toast } from 'sonner';

// --- Validation Schema ---
const scheduleSchema = z
  .object({
    subject: z.string().min(1, 'Subject name is required').max(100),
    room: z.string().min(1, 'Room is required').max(50),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
  });

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

// --- Helper Functions to Generate Options ---
const generateDateOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    // Value: YYYY-MM-DD
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    // Label: "Mon, Apr 12"
    let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (i === 0) label = "Today (" + label + ")";
    if (i === 1) label = "Tomorrow (" + label + ")";

    options.push({ value, label });
  }
  return options;
};

const generateTimeOptions = () => {
  const options = [];
  for (let h = 6; h <= 20; h++) { // 6 AM to 8 PM
    for (let m of ['00', '30']) {
      const isPM = h >= 12;
      const displayH = h > 12 ? h - 12 : h;
      const label = `${displayH}:${m} ${isPM ? 'PM' : 'AM'}`;
      const value = `${String(h).padStart(2, '0')}:${m}`;
      options.push({ value, label });
    }
  }
  return options;
};

// --- Component ---
export default function AdminPanel() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
  });

  const onSubmit = async (data: ScheduleFormValues) => {
    setIsSubmitting(true);
    try {
      // Construct ISO format timestamp for start time
      const startDateTime = `${data.date}T${data.startTime}:00`;
      
      // Auto-compute an end time 1 hour after start to satisfy any NOT NULL constraints
      const startDateObj = new Date(startDateTime);
      startDateObj.setHours(startDateObj.getHours() + 1);
      const endDateTime = startDateObj.toISOString();

      // Insert the new schedule into Supabase
      const { error } = await supabase
        .from('schedules')
        .insert({
          subject: data.subject,
          room: data.room,
          start_time: startDateTime,
          end_time: endDateTime,
          created_by: user?.id,
        });

      if (error) {
        throw error;
      }

      // Show success notification
      toast.success(`"${data.subject}" class has been added successfully!`);
      
      // Reset form after successful submission
      reset();
    } catch (error: any) {
      console.error('Failed to create schedule:', error.message);
      toast.error(`Failed to add schedule: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Add New Schedule
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create a new class schedule for students to attend.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Subject Name Input */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Subject Name
            </label>
            <input
              id="subject"
              type="text"
              placeholder="e.g. Advanced Mathematics"
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white ${
                errors.subject
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
              }`}
              {...register('subject')}
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          {/* Room Input */}
          <div>
            <label htmlFor="room" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Room
            </label>
            <input
              id="room"
              type="text"
              placeholder="e.g. Building A - Room 101"
              className={`mt-1 block w-full rounded-lg border bg-white px-4 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white ${
                errors.room
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
              }`}
              {...register('room')}
            />
            {errors.room && (
              <p className="mt-1 text-sm text-red-500">{errors.room.message}</p>
            )}
          </div>

          {/* Date and Time Inputs Group for better layout */}
          <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6">
            
            {/* Date Selection */}
            <div className="sm:col-span-2">
              <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <select
                id="date"
                className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white ${
                  errors.date
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
                }`}
                {...register('date')}
              >
                <option value="">Select Date...</option>
                {generateDateOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.date && (
                <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>

            {/* Start Time */}
            <div className="sm:col-span-1">
              <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Start Time
              </label>
              <select
                id="startTime"
                className={`mt-1 block w-full rounded-lg border bg-white px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white ${
                  errors.startTime
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
                }`}
                {...register('startTime')}
              >
                <option value="">Select Time...</option>
                {generateTimeOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-500">{errors.startTime.message}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 dark:focus:ring-offset-slate-900"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Schedule...
                </>
              ) : (
                'Add Schedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

// Define the Profile type matching your database schema
export interface Profile {
  user_id: string;
  name: string;
  role: 'student' | 'admin' | 'teacher';
  custom_bg_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const createProfile = async (userId: string, email: string): Promise<Profile | null> => {
    try {
      const newProfile: Profile = {
        user_id: userId,
        name: email.split('@')[0], // Use email prefix as fallback name
        role: 'student',
        custom_bg_url: null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error.message);
        return null;
      }

      console.log('Auto-created profile for user:', userId);
      return data as Profile;
    } catch (err) {
      console.error('Unexpected error creating profile:', err);
      return null;
    }
  };

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        // Profile doesn't exist - trigger auto-creation
        if (email) {
          console.warn('Profile not found for user, attempting auto-creation...');
          const createdProfile = await createProfile(userId, email);
          setProfile(createdProfile);
        } else {
          console.error('Error fetching profile:', error.message);
          setProfile(null);
        }
      } else {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error.message);
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await fetchProfile(currentUser.id, currentUser.email);
        }
      } catch (err) {
        console.error('Initialization auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          
          if (currentUser) {
            await fetchProfile(currentUser.id, currentUser.email);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error('Auth change handling error:', err);
        } finally {
          setLoading(false);
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error signing in:', error.message);
      throw error; // Throw error so the UI can catch and display it
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
