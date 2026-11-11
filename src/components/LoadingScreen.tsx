import React from 'react';
import { Compass, Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Verifying your session...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full mx-4 text-center">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-md">
          <Compass className="w-8 h-8 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-xs">
            <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Career Pivot Coach</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
