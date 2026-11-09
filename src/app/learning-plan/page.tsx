'use client';

import { useState } from 'react';
import { 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trophy,
  Sliders,
  Check,
  Save,
  Layers,
  FolderGit2
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, LearningPlan } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';

export default function LearningPlanPage() {
  const [state, setState] = useAppState();
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(10);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [savedSuccessBanner, setSavedSuccessBanner] = useState(false);



  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <RefreshCw className="animate-spin text-indigo-600" size={16} />
          <span>Loading Learning Plan...</span>
        </div>
      </div>
    );
  }

  const { learningPlan, skillGapMap, profile } = state;

  // Toggle a general task
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

  // Toggle the Prove It Task for a week
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

  // Generate / Recalculate learning plan from gaps
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const res = await fetch('/api/ai/generate-learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoursPerWeek,
          durationWeeks,
          skillGaps: skillGapMap.skills || [],
          profile: profile
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.friendlyMessage || data.error || 'Failed to generate learning plan');

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

      setStatusMessage({
        text: `Custom ${data.durationWeeks}-week plan generated! Biggest gaps prioritized first (${data.hoursPerWeek} hrs/week).`,
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating learning plan';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual save
  const handleSavePlan = () => {
    saveStoredState(state);
    setSavedSuccessBanner(true);
    setStatusMessage({ text: 'Learning plan and task progress saved locally.', type: 'success' });
    setTimeout(() => setSavedSuccessBanner(false), 4000);
  };

  // Task metrics calculation
  const allTasks = learningPlan.weeks.flatMap(w => w.tasks || []);
  const allProveItTasks = learningPlan.weeks.map(w => w.proveItTask).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const totalTasksCount = allTasks.length + allProveItTasks.length;
  const completedGeneralTasks = allTasks.filter(t => t.completed).length;
  const completedProveItTasks = allProveItTasks.filter(p => p.completed).length;
  const totalCompletedCount = completedGeneralTasks + completedProveItTasks;
  const progressPercent = totalTasksCount > 0 ? Math.round((totalCompletedCount / totalTasksCount) * 100) : 0;
  const totalCurriculumHours = learningPlan.durationWeeks * (learningPlan.hoursPerWeek || hoursPerWeek);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2">
              <CalendarDays size={14} className="shrink-0" />
              <span>Targeted Re-Skilling Curriculum</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Week-by-Week Learning Plan
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Constructed directly from your market skill gaps with the biggest gaps tackled first. Each week includes a theme, 2 to 3 concepts to learn, 1 proof task, and allocated hours.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <FolderGit2 size={14} className="shrink-0" />
              <span>View 3 Portfolio Projects</span>
            </Link>

            <button
              onClick={handleSavePlan}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Save size={14} className="shrink-0" />
              <span>Save Progress</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Sparkles size={16} className="shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {savedSuccessBanner && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>Plan progress saved! Synced to your browser workspace.</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Generating Loading State */}
      {isGenerating && (
        <AILoadingIndicator
          title="AI Curriculum Engine Active"
          stages={[
            "Analyzing critical market skill gaps & missing competencies...",
            "Structuring week-by-week curriculum (tackling biggest gaps first)...",
            `Calibrating weekly hours (${hoursPerWeek}h/wk) and designing prove-it tasks...`,
            "Synthesizing 3 tailored capstone portfolio projects..."
          ]}
        />
      )}

      {/* SECTION 1: Interactive Time Configuration (Hours Per Week & Number of Weeks) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>1. Schedule & Curriculum Configuration</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set your available weekly hours and plan duration. We re-balance the curriculum to fit your exact pacing.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-indigo-100 dark:shadow-indigo-950"
          >
            {isGenerating ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Sparkles size={14} className="shrink-0" />}
            <span>{isGenerating ? 'Recalculating Plan...' : 'Recalculate Plan From Gaps'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hours Per Week */}
          <div className="space-y-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Hours Available Per Week</span>
              </label>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                {hoursPerWeek} hrs/week
              </span>
            </div>

            {/* Quick preset pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHoursPerWeek(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    hoursPerWeek === preset
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset} hrs/week
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-slate-400">Custom:</span>
                <input
                  type="number"
                  min={3}
                  max={40}
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-center"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Allocated across theory (30%), practical exercises (30%), and proof tasks (40%).
            </p>
          </div>

          {/* Number of Weeks */}
          <div className="space-y-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CalendarDays size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Plan Duration (Weeks)</span>
              </label>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                {durationWeeks} Weeks
              </span>
            </div>

            {/* Quick preset pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[4, 6, 8, 12].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationWeeks(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    durationWeeks === preset
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset} Weeks
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-slate-400">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Math.max(1, parseInt(e.target.value) || 4))}
                  className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-center"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Total curriculum commitment: ~{totalCurriculumHours} hours to job readiness.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Progress & High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Progress % */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Syllabus Completion
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {progressPercent}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalCompletedCount} of {totalTasksCount} tasks checked off
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Trophy size={24} className="shrink-0" />
          </div>
        </div>

        {/* Commitment Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pacing Commitment
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {hoursPerWeek}h / wk
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ~{totalCurriculumHours} total hours across {durationWeeks} weeks
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Clock size={24} className="shrink-0" />
          </div>
        </div>

        {/* Priority Focus */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Primary Focus (Biggest Gap)
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
              {skillGapMap.skills.find(s => s.matchStatus === 'lacks')?.skillName || 'SQL & Relational Queries'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tackled in Weeks 1 & 2
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers size={24} className="shrink-0" />
          </div>
        </div>
      </div>

      {/* SECTION 3: The Week-by-Week Plan (Biggest Gaps First) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Weekly Curriculum (Biggest Gaps First)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tick tasks off as you complete them to update your progress.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {learningPlan.weeks.length} Weeks Structured
          </span>
        </div>

        <div className="space-y-6">
          {learningPlan.weeks.map((week) => {
            const weekTasks = week.tasks || [];
            const weekTasksDone = weekTasks.filter(t => t.completed).length + (week.proveItTask?.completed ? 1 : 0);
            const totalWeekTasks = weekTasks.length + (week.proveItTask ? 1 : 0);
            const isWeekFinished = totalWeekTasks > 0 && weekTasksDone === totalWeekTasks;

            return (
              <div 
                key={week.weekNumber}
                className={`p-6 sm:p-7 rounded-2xl border transition-all bg-white dark:bg-slate-900 shadow-xs space-y-5 ${
                  isWeekFinished
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                {/* Week Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${
                      isWeekFinished
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-indigo-600 text-white shadow-xs shadow-indigo-100 dark:shadow-indigo-950'
                    }`}>
                      W{week.weekNumber}
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {week.theme}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {week.targetSkills.map((sk, idx) => (
                          <span 
                            key={idx} 
                            className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {week.hoursNeeded || hoursPerWeek} Hours Needed
                    </span>

                    {isWeekFinished && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2 or 3 Things to Learn */}
                <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Things to Learn This Week</span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                    {(week.thingsToLearn || [
                      'Core foundations and relational theory',
                      'Applied syntax and practical drills',
                      'Edge case handling and verification'
                    ]).map((thing, idx) => (
                      <li 
                        key={idx} 
                        className="text-xs text-slate-700 dark:text-slate-300 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-2 leading-relaxed"
                      >
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                        <span>{thing}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* One Small Task to Prove It */}
                {week.proveItTask && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-950/10 dark:to-transparent border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Trophy size={16} className="shrink-0" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Prove-It Task (Tangible Deliverable)
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            ~{week.proveItTask.estimatedHours} Hours
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 leading-relaxed font-medium ${
                          week.proveItTask.completed 
                            ? 'line-through text-slate-400 dark:text-slate-500' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {week.proveItTask.description}
                        </p>
                        {week.proveItTask.deliverableProof && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-mono">
                            Artifact: {week.proveItTask.deliverableProof}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleProveItTask(week.weekNumber)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        week.proveItTask.completed
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      <Check size={14} className="shrink-0" />
                      <span>{week.proveItTask.completed ? 'Proved & Done' : 'Tick When Proved'}</span>
                    </button>
                  </div>
                )}

                {/* Interactive Tasks Checklist */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>Weekly Action Checklist ({weekTasksDone} of {totalWeekTasks} done)</span>
                    <span className="text-[11px] lowercase font-normal">Click checkbox to tick off</span>
                  </div>

                  <div className="space-y-2">
                    {weekTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(week.weekNumber, task.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          task.completed
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/70 text-slate-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleTask(week.weekNumber, task.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <p className={`text-xs font-medium leading-relaxed ${
                              task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {task.description}
                            </p>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Focus: {task.skillTarget}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          {task.estimatedHours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Bridge to Portfolio Projects Page */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded-md">
            Next Milestone: Verifiable Proof
          </span>
          <h3 className="text-xl font-bold tracking-tight">
            Prove These Skills With 3 Strategic Portfolio Projects
          </h3>
          <p className="text-xs text-indigo-200 leading-relaxed">
            Certificates get ignored; hiring managers look for verifiable evidence. Explore the 3 tailored capstone projects designed to close these exact gaps with step-by-step build plans and resume bullets.
          </p>
        </div>

        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 transition-all cursor-pointer shadow-md shrink-0"
        >
          <span>View 3 Portfolio Projects</span>
          <ArrowRight size={14} className="shrink-0" />
        </Link>
      </div>
    </div>
  );
}
