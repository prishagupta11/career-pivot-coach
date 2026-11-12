'use client';

import { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Check, 
  RefreshCw, 
  PlusCircle, 
  Undo2, 
  AlertCircle 
} from 'lucide-react';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, LearningPlan, PlanChangeItem, PlanAdjustmentRecord } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';
import { apiFetch } from '@/lib/apiClient';

export default function ProgressPage() {
  const [state, setState] = useAppState();
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [loggedExtraHours, setLoggedExtraHours] = useState<number>(0);
  const [adjustmentResult, setAdjustmentResult] = useState<{
    summary: string;
    rationale: string;
    changes: PlanChangeItem[];
    revisedPlan: LearningPlan;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { learningPlan, interviews, skillGapMap, profile, previousPlan } = state || {
    learningPlan: { durationWeeks: 4, hoursPerWeek: 10, weeks: [], portfolioProject: { title: '', tagline: '', problemStatement: '', demonstratedSkills: [], deliverables: [], milestones: [] }, lastGenerated: '' },
    interviews: [],
    skillGapMap: { overallMatchPercentage: 0, skills: [], criticalGapsCount: 0, lastAnalyzed: '' },
    profile: { targetRole: '', currentRole: '' }
  };

  const totalTasks = useMemo(() => {
    return learningPlan?.weeks?.reduce((acc, w) => acc + (w.tasks?.length || 0), 0) || 0;
  }, [learningPlan]);

  const completedTasks = useMemo(() => {
    return learningPlan?.weeks?.reduce((acc, w) => acc + (w.tasks?.filter(t => t.completed)?.length || 0), 0) || 0;
  }, [learningPlan]);

  const tasksPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const plannedHours = useMemo(() => {
    if (!learningPlan?.weeks || learningPlan.weeks.length === 0) return 0;
    return learningPlan.weeks.reduce((acc, w) => acc + (w.hoursNeeded || learningPlan.hoursPerWeek || 10), 0);
  }, [learningPlan]);

  const completedTaskHours = useMemo(() => {
    let hrs = 0;
    learningPlan?.weeks?.forEach(w => {
      w.tasks?.forEach(t => {
        if (t.completed) hrs += (t.estimatedHours || 2);
      });
      if (w.proveItTask?.completed) {
        hrs += (w.proveItTask.estimatedHours || 3);
      }
    });
    return hrs;
  }, [learningPlan]);

  const totalHoursStudied = completedTaskHours + loggedExtraHours;
  const hoursProgressPercent = plannedHours > 0 ? Math.min(Math.round((totalHoursStudied / plannedHours) * 100), 100) : 0;

  const recentInterview = interviews?.[0] || null;
  const recentScore = (recentInterview?.rubric?.totalScore || recentInterview?.scores?.totalScore) ?? null;
  const maxInterviewScore = recentInterview?.rubric?.maxScore || 25;

  const avgInterviewScore = useMemo(() => {
    if (!interviews || interviews.length === 0) return null;
    const scores = interviews.map(i => i.rubric?.totalScore || i.scores?.totalScore || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round(sum / scores.length);
  }, [interviews]);

  const weakestSkills = useMemo(() => {
    if (!skillGapMap?.skills) return [];
    return skillGapMap.skills
      .filter(s => s.matchStatus === 'lacks' || s.matchStatus === 'partly' || s.gapSeverity === 'Critical')
      .map(s => s.skillName);
  }, [skillGapMap]);

  const strongSkills = useMemo(() => {
    if (!skillGapMap?.skills) return [];
    return skillGapMap.skills
      .filter(s => s.candidateHas || s.matchStatus === 'has')
      .map(s => s.skillName);
  }, [skillGapMap]);

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

  const handleToggleTask = (weekNum: number, taskId: string) => {
    const updatedWeeks = learningPlan.weeks.map(w => {
      if (w.weekNumber === weekNum) {
        return {
          ...w,
          tasks: w.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return w;
    });

    const updatedState = {
      ...state,
      learningPlan: { ...learningPlan, weeks: updatedWeeks }
    };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const handleAdjustMyPlan = async () => {
    setIsAdjusting(true);
    setStatusMessage(null);

    try {
      const res = await apiFetch('/api/ai/adjust-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learningPlan,
          tasksFinishedCount: completedTasks,
          totalTasksCount: totalTasks,
          hoursStudied: totalHoursStudied,
          plannedHours,
          interviewScores: {
            recentScore,
            averageScore: avgInterviewScore,
            weakestCriterion: 'Technical Accuracy'
          },
          weakestSkills,
          strongSkills,
          targetRole: profile.targetRole || 'Target Role'
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      setAdjustmentResult(data);
    } catch {
      setStatusMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleApplyRevisedPlan = () => {
    if (!adjustmentResult) return;

    const adjustmentRecord: PlanAdjustmentRecord = {
      id: `adj-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      summary: adjustmentResult.summary,
      rationale: adjustmentResult.rationale,
      changes: adjustmentResult.changes,
      previousPlan: learningPlan,
      revisedPlan: adjustmentResult.revisedPlan
    };

    const updatedState: AppState = {
      ...state,
      previousPlan: learningPlan,
      learningPlan: adjustmentResult.revisedPlan,
      planAdjustments: [adjustmentRecord, ...(state.planAdjustments || [])]
    };

    saveStoredState(updatedState);
    setState(updatedState);
    setAdjustmentResult(null);
    setStatusMessage({ text: 'Revised plan applied.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRevertPlan = () => {
    if (!previousPlan && !adjustmentResult) return;

    if (adjustmentResult) {
      setAdjustmentResult(null);
      return;
    }

    if (previousPlan) {
      const updatedState: AppState = {
        ...state,
        learningPlan: previousPlan,
        previousPlan: undefined
      };

      saveStoredState(updatedState);
      setState(updatedState);
      setStatusMessage({ text: 'Reverted to previous plan.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track study hours and adapt your plan.
          </p>
        </div>

        {/* ONE AI button: "Adjust my plan" */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAdjustMyPlan}
            disabled={isAdjusting || !learningPlan?.weeks?.length || !profile?.targetRole}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isAdjusting && <RefreshCw size={14} className="animate-spin shrink-0" />}
            <span>Adjust my plan</span>
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

      {isAdjusting && (
        <AILoadingIndicator />
      )}

      {/* Adjustment Result with Apply and Revert (No executive calibration summary text) */}
      {adjustmentResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Proposed Plan Adjustments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review proposed changes below.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyRevisedPlan}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Check size={14} className="shrink-0" />
                <span>Apply</span>
              </button>

              <button
                type="button"
                onClick={handleRevertPlan}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Undo2 size={14} className="shrink-0" />
                <span>Revert</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {(adjustmentResult.changes || []).map((change, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Week {change.weekNumber}:
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {change.description}
                  </span>
                </div>
                {change.reason && (
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {change.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Previous plan banner if can revert */}
      {!adjustmentResult && previousPlan && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-300">
            A previously adjusted plan is active.
          </span>
          <button
            type="button"
            onClick={handleRevertPlan}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <Undo2 size={13} className="shrink-0" />
            <span>Revert to Previous Plan</span>
          </button>
        </div>
      )}

      {learningPlan.weeks.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Plan to Track"
          description="Generate a learning plan to track weekly milestones and study hours."
          action={{
            label: "Go to Learning Plan",
            href: "/learning-plan"
          }}
        />
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tasks Completed
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {completedTasks} <span className="text-sm font-normal text-slate-400">/ {totalTasks}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${tasksPercent}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Hours Studied
                </span>
                <button
                  type="button"
                  onClick={() => setLoggedExtraHours(prev => prev + 1)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={13} />
                  <span>+1 hr</span>
                </button>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalHoursStudied} <span className="text-sm font-normal text-slate-400">/ {plannedHours} hrs</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${hoursProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Interview Score
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {recentScore !== null ? `${recentScore} / ${maxInterviewScore}` : '—'}
              </div>
              <div className="text-xs text-slate-500">
                {interviews.length} attempts recorded
              </div>
            </div>
          </div>

          {/* Weekly Task Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Weekly Tasks
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learningPlan.weeks.map((week) => {
                const weekTasksCount = week.tasks?.length || 0;
                const weekDoneCount = week.tasks?.filter(t => t.completed)?.length || 0;

                return (
                  <div
                    key={week.weekNumber}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Week {week.weekNumber}: {week.theme}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {weekDoneCount}/{weekTasksCount}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {week.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(week.weekNumber, task.id)}
                          className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}>
                            {task.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
