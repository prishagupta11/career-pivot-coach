'use client';

import { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  ArrowRight,
  RefreshCw,
  Trophy,
  Check,
  Save,
  FolderGit2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, LearningPlan } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';
import { apiFetch } from '@/lib/apiClient';

export default function LearningPlanPage() {
  const [state, setState] = useAppState();
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(10);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savedSuccessBanner, setSavedSuccessBanner] = useState(false);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <RefreshCw className="animate-spin text-indigo-600" size={16} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const { learningPlan, skillGapMap, profile } = state;

  const toggleTask = (weekNum: number, taskId: string) => {
    const updatedWeeks = learningPlan.weeks.map(w => {
      if (w.weekNumber === weekNum) {
        return {
          ...w,
          tasks: w.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return w;
    });

    const updatedPlan: LearningPlan = { ...learningPlan, weeks: updatedWeeks };
    const updatedState: AppState = { ...state, learningPlan: updatedPlan };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const toggleProveItTask = (weekNum: number) => {
    const updatedWeeks = learningPlan.weeks.map(w => {
      if (w.weekNumber === weekNum && w.proveItTask) {
        return {
          ...w,
          proveItTask: {
            ...w.proveItTask,
            completed: !w.proveItTask.completed
          }
        };
      }
      return w;
    });

    const updatedPlan: LearningPlan = { ...learningPlan, weeks: updatedWeeks };
    const updatedState: AppState = { ...state, learningPlan: updatedPlan };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const res = await apiFetch('/api/ai/generate-learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoursPerWeek,
          durationWeeks,
          skillGaps: skillGapMap.skills || [],
          profile: profile
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      const updatedPlan: LearningPlan = {
        durationWeeks: data.durationWeeks,
        hoursPerWeek: data.hoursPerWeek,
        weeks: data.weeks,
        portfolioProject: learningPlan.portfolioProject,
        portfolioProjects: data.portfolioProjects || learningPlan.portfolioProjects,
        lastGenerated: new Date().toISOString()
      };

      const updatedState: AppState = {
        ...state,
        learningPlan: updatedPlan
      };

      saveStoredState(updatedState);
      setState(updatedState);
    } catch {
      setStatusMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = () => {
    saveStoredState(state);
    setSavedSuccessBanner(true);
    setTimeout(() => setSavedSuccessBanner(false), 3000);
  };

  const allTasks = learningPlan.weeks.flatMap(w => w.tasks || []);
  const allProveItTasks = learningPlan.weeks.map(w => w.proveItTask).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const totalTasksCount = allTasks.length + allProveItTasks.length;
  const completedGeneralTasks = allTasks.filter(t => t.completed).length;
  const completedProveItTasks = allProveItTasks.filter(p => p.completed).length;
  const totalCompletedCount = completedGeneralTasks + completedProveItTasks;
  const progressPercent = totalTasksCount > 0 ? Math.round((totalCompletedCount / totalTasksCount) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learning Plan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your weekly study schedule and deliverables.
          </p>
        </div>

        {/* ONE clear AI action: "Generate plan" */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating || !profile.targetRole}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isGenerating && <RefreshCw size={14} className="animate-spin shrink-0" />}
            <span>Generate plan</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {savedSuccessBanner && (
        <div className="p-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2">
          <Check size={16} className="shrink-0" />
          <span>Plan saved successfully.</span>
        </div>
      )}

      {isGenerating && (
        <AILoadingIndicator />
      )}

      {/* Schedule Configuration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Schedule Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hours Per Week
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {hoursPerWeek} hrs
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHoursPerWeek(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    hoursPerWeek === preset
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {preset} hrs/wk
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Duration (Weeks)
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {durationWeeks} weeks
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[4, 6, 8, 12].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationWeeks(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    durationWeeks === preset
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {preset} wks
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {learningPlan.weeks.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Learning Plan Generated Yet"
          description={
            !profile.targetRole
              ? "Set your target role in Profile first, then generate a learning plan."
              : "Click Generate plan above to create your schedule."
          }
          action={
            !profile.targetRole
              ? { label: "Go to Profile", href: "/profile" }
              : { label: isGenerating ? "Working on it..." : "Generate plan", onClick: handleGeneratePlan, disabled: isGenerating }
          }
        />
      ) : (
        <>
          {/* Progress Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tasks Completed
                </span>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {progressPercent}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {totalCompletedCount} of {totalTasksCount} tasks
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Trophy size={20} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target Pacing
                </span>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {hoursPerWeek}h / wk
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {durationWeeks} weeks planned
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Weekly Weeks List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Weekly Schedule
              </h2>
              <button
                type="button"
                onClick={handleSavePlan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Save size={13} className="shrink-0" />
                <span>Save</span>
              </button>
            </div>

            <div className="space-y-4">
              {learningPlan.weeks.map((week) => {
                const weekTasks = week.tasks || [];
                const weekTasksDone = weekTasks.filter(t => t.completed).length + (week.proveItTask?.completed ? 1 : 0);
                const totalWeekTasks = weekTasks.length + (week.proveItTask ? 1 : 0);
                const isWeekFinished = totalWeekTasks > 0 && weekTasksDone === totalWeekTasks;

                return (
                  <div 
                    key={week.weekNumber}
                    className={`p-5 rounded-2xl border transition-all bg-white dark:bg-slate-900 shadow-xs space-y-4 ${
                      isWeekFinished
                        ? 'border-emerald-300 dark:border-emerald-800'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg text-xs font-bold bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          W{week.weekNumber}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {week.theme}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {week.hoursNeeded || hoursPerWeek} hrs
                        </span>
                        {isWeekFinished && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={13} className="shrink-0" />
                            <span>Done</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Topics */}
                    {week.thingsToLearn && week.thingsToLearn.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <BookOpen size={12} className="shrink-0" />
                          <span>Key Topics</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {week.thingsToLearn.map((thing, idx) => (
                            <span 
                              key={idx}
                              className="text-xs text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            >
                              {thing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prove It Task */}
                    {week.proveItTask && (
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <Trophy size={15} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Milestone Task
                            </span>
                            <p className={`text-xs mt-0.5 leading-relaxed font-medium ${
                              week.proveItTask.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}>
                              {week.proveItTask.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleProveItTask(week.weekNumber)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                            week.proveItTask.completed
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {week.proveItTask.completed ? 'Completed' : 'Mark Done'}
                        </button>
                      </div>
                    )}

                    {/* Tasks Checklist */}
                    <div className="space-y-1.5">
                      {weekTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(week.weekNumber, task.id)}
                          className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTask(week.weekNumber, task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <p className={`text-xs ${
                              task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {task.description}
                            </p>
                          </div>

                          <span className="text-[11px] text-slate-400 shrink-0">
                            {task.estimatedHours}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Steps Link */}
          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
            >
              <FolderGit2 size={14} className="shrink-0" />
              <span>Portfolio Projects</span>
            </Link>

            <Link
              href="/mock-interview"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
            >
              <span>Continue to Mock Interview</span>
              <ArrowRight size={14} className="shrink-0" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
