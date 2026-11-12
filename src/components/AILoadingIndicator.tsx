'use client';

import { RefreshCw } from 'lucide-react';

interface AILoadingIndicatorProps {
  title?: string;
  stages?: string[];
  durationMsPerStage?: number;
}

export default function AILoadingIndicator({
  title = 'Working on it...',
}: AILoadingIndicatorProps) {
  const displayMessage =
    title === 'AI is processing...' || !title || title.includes('Active')
      ? 'Working on it...'
      : title;

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 shadow-xs flex items-center gap-3">
      <RefreshCw size={16} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {displayMessage}
      </span>
    </div>
  );
}
