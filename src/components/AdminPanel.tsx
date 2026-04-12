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
      // Construct a local date/time and convert both values to ISO for Supabase
      const startDateObj = new Date(`${data.date}T${data.startTime}:00`);
      const endDateObj = new Date(startDateObj);
      endDateObj.setHours(endDateObj.getHours() + 1);
      const startDateTime = startDateObj.toISOString();
      const endDateTime = endDateObj.toISOString();

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
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Add New Schedule
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create a new class schedule for students to attend.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Subject Name Input */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Subject Name
            </label>
            <input
              id="subject"
              type="text"
              placeholder="e.g. Advanced Mathematics"
                className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white sm:px-4 ${
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
                className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white sm:px-4 ${
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
          <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0">
            
            {/* Date Selection */}
            <div className="sm:col-span-1">
              <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                id="date"
                type="date"
                className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white sm:px-4 sm:py-3 ${
                  errors.date
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
                }`}
                {...register('date')}
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>

            {/* Start Time */}
            <div className="sm:col-span-1">
              <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Start Time
              </label>
              <input
                id="startTime"
                type="time"
                className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white sm:px-4 sm:py-3 ${
                  errors.startTime
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500/50 dark:focus:ring-red-900'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-600 dark:focus:ring-blue-900'
                }`}
                {...register('startTime')}
              />
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-500">{errors.startTime.message}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 sm:pt-4">
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
