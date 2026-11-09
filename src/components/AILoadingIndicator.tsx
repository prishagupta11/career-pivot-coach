'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface AILoadingIndicatorProps {
  title?: string;
  stages: string[];
  durationMsPerStage?: number;
}

export default function AILoadingIndicator({
  title = 'AI is processing...',
  stages,
  durationMsPerStage = 2200
}: AILoadingIndicatorProps) {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    if (stages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => (prev + 1) % stages.length);
    }, durationMsPerStage);
    return () => clearInterval(interval);
  }, [stages, durationMsPerStage]);

  return (
    <div className="p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-indigo-50/70 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 shadow-xs animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0">
            <RefreshCw size={18} className="animate-spin" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {title}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                Live AI Engine
              </span>
            </div>

            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mt-1 flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0 text-indigo-500 animate-bounce" />
              <span>{stages[currentStageIdx]}</span>
            </p>
          </div>
        </div>

        {/* Stage progress dots */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {stages.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStageIdx
                  ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                  : idx < currentStageIdx
                  ? 'w-2 bg-indigo-300 dark:bg-indigo-700'
                  : 'w-2 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
