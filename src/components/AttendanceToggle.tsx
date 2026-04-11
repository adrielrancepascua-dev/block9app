import React from 'react';

export type AttendanceStatus = 'going' | 'late' | 'absent' | null;

export interface AttendanceToggleProps {
  scheduleId: string;
  currentStatus: AttendanceStatus;
  onStatusChange: (scheduleId: string, status: NonNullable<AttendanceStatus>) => void;
}

export default function AttendanceToggle({
  scheduleId,
  currentStatus,
  onStatusChange,
}: AttendanceToggleProps) {
  return (
    <div className="inline-flex rounded-md shadow-sm" role="group">
      {/* 
        Going Button 
        Active: Solid Green 
        Inactive: Outline 
      */}
      <button
        type="button"
        onClick={() => onStatusChange(scheduleId, 'going')}
        className={`px-4 py-2 text-sm font-medium border rounded-l-lg focus:z-10 focus:ring-2 transition-colors ${
          currentStatus === 'going'
            ? 'z-10 bg-green-600 border-green-600 text-white hover:bg-green-700 focus:ring-green-500'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-green-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 focus:ring-slate-200'
        }`}
      >
        Going
      </button>

      {/* 
        Late Button 
        Active: Solid Orange/Yellow
        Inactive: Outline 
        Note: -ml-px to prevent double borders
      */}
      <button
        type="button"
        onClick={() => onStatusChange(scheduleId, 'late')}
        className={`-ml-px px-4 py-2 text-sm font-medium border focus:z-10 focus:ring-2 transition-colors ${
          currentStatus === 'late'
            ? 'z-10 bg-orange-500 border-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-orange-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 focus:ring-slate-200'
        }`}
      >
        Late
      </button>

      {/* 
        Absent Button 
        Active: Solid Red
        Inactive: Outline 
        Note: -ml-px to prevent double borders
      */}
      <button
        type="button"
        onClick={() => onStatusChange(scheduleId, 'absent')}
        className={`-ml-px px-4 py-2 text-sm font-medium border rounded-r-lg focus:z-10 focus:ring-2 transition-colors ${
          currentStatus === 'absent'
            ? 'z-10 bg-red-600 border-red-600 text-white hover:bg-red-700 focus:ring-red-500'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-red-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 focus:ring-slate-200'
        }`}
      >
        Absent
      </button>
    </div>
  );
}
