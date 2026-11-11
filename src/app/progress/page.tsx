'use client';

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Trophy, 
  Sliders, 
  Check, 
  RefreshCw,
  PlusCircle,
  Undo2
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, LearningPlan, PlanChangeItem, PlanAdjustmentRecord } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';
import { apiFetch } from '@/lib/apiClient';

export default function ProgressPage() {
  const [state, setState] = useAppState();
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'before_after'>('overview');
  const [loggedExtraHours, setLoggedExtraHours] = useState<number>(0);
  const [adjustmentResult, setAdjustmentResult] = useState<{
    summary: string;
    rationale: string;
    changes: PlanChangeItem[];
    revisedPlan: LearningPlan;
  } | null>(null);
  const [appliedSuccessMessage, setAppliedSuccessMessage] = useState<string | null>(null);

  // Compute Core Metrics
  const { learningPlan, interviews, skillGapMap, profile, previousPlan } = state || {
    learningPlan: { durationWeeks: 4, hoursPerWeek: 10, weeks: [], portfolioProject: { title: '', tagline: '', problemStatement: '', demonstratedSkills: [], deliverables: [], milestones: [] }, lastGenerated: '' },
    interviews: [],
    skillGapMap: { overallMatchPercentage: 0, skills: [], criticalGapsCount: 0, lastAnalyzed: '' },
    profile: { targetRole: '', currentRole: '' }
  };

  // 1. Tasks Finished metrics
  const totalTasks = useMemo(() => {
    return learningPlan?.weeks?.reduce((acc, w) => acc + (w.tasks?.length || 0), 0) || 0;
  }, [learningPlan]);

  const completedTasks = useMemo(() => {
    return learningPlan?.weeks?.reduce((acc, w) => acc + (w.tasks?.filter(t => t.completed)?.length || 0), 0) || 0;
  }, [learningPlan]);

  const tasksPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Hours Studied vs Planned
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
  const isPacingBehind = plannedHours > 0 && totalHoursStudied < (plannedHours * 0.45) && completedTasks < (totalTasks * 0.5);

  // 3. Interview Score Trends
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
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        <p>Loading Progress & Milestone Analytics...</p>
      </div>
    );
  }

  // Toggle Task Completion from Progress View
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

  // Adjust Plan with Gemini
  const handleAdjustMyPlan = async () => {
    setIsAdjusting(true);
    setAppliedSuccessMessage(null);

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
            weakestCriterion: 'Technical Accuracy & Domain Vocabulary'
          },
          weakestSkills,
          strongSkills,
          targetRole: profile.targetRole || 'Target Role'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust learning plan');

      setAdjustmentResult(data);
      setActiveTab('before_after');
    } catch (err) {
      console.error('Error adjusting plan:', err);
      alert('Unable to calibrate learning plan right now. Please try again.');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Apply Revised Plan to State
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
      previousPlan: learningPlan, // keep old version for before and after
      learningPlan: adjustmentResult.revisedPlan,
      planAdjustments: [adjustmentRecord, ...(state.planAdjustments || [])]
    };

    saveStoredState(updatedState);
    setState(updatedState);
    setAppliedSuccessMessage('Revised plan successfully applied! Your weekly roadmap and projects have been updated.');
    setTimeout(() => setAppliedSuccessMessage(null), 5000);
  };

  // Revert to Previous Plan
  const handleRevertPlan = () => {
    if (!previousPlan) return;

    const updatedState: AppState = {
      ...state,
      learningPlan: previousPlan,
      previousPlan: undefined
    };

    saveStoredState(updatedState);
    setState(updatedState);
    setAdjustmentResult(null);
    setActiveTab('overview');
    setAppliedSuccessMessage('Reverted to your previous learning plan.');
    setTimeout(() => setAppliedSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Velocity & Dynamic Pacing Calibration</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Transition Progress & Adaptive Plan
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Synthesize your execution velocity across completed milestones, mock interview performance, and logged study hours. If life gets busy or a skill needs deeper practice, let AI dynamically calibrate your roadmap.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
          <button
            onClick={handleAdjustMyPlan}
            disabled={isAdjusting || !learningPlan?.weeks?.length || !profile?.targetRole}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-all cursor-pointer shadow-sm hover:shadow-md"
          >
            {isAdjusting ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Sliders className="w-4 h-4 shrink-0" />}
            <span>{isAdjusting ? 'Calibrating Plan...' : 'Adjust My Plan with AI'}</span>
          </button>

          {previousPlan && (
            <button
              onClick={handleRevertPlan}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span>Revert to Previous Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Applied Success Notification */}
      {appliedSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{appliedSuccessMessage}</span>
          </div>
          <Link href="/learning-plan" className="underline font-bold hover:text-emerald-900">
            View Learning Plan →
          </Link>
        </div>
      )}

      {/* Loading State during plan adjustment */}
      {isAdjusting && (
        <AILoadingIndicator
          title="Analyzing Progress & Recalibrating Curriculum with Gemini..."
          stages={[
            "Auditing hours studied vs planned curriculum velocity...",
            "Evaluating mock interview rubric trends and score progression...",
            "Checking whether candidate is behind schedule (stretching timeline or trimming)...",
            "Accelerating validated skill strengths and inserting practice for weakest gaps...",
            "Generating before-and-after change diff and revised roadmap..."
          ]}
        />
      )}

      {learningPlan.weeks.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No Learning Plan to Track Yet"
          description={
            !profile?.targetRole
              ? "Set your target role in Profile, then generate your learning plan to track execution velocity and pacing."
              : "Generate your learning plan to start tracking weekly milestones, study hours, and interview progress."
          }
          action={
            !profile?.targetRole
              ? { label: "Go to Profile", href: "/profile" }
              : { label: "Go to Learning Plan", href: "/learning-plan" }
          }
        />
      ) : (
        <>
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Progress Overview & Velocity
            </button>

            {(adjustmentResult || previousPlan) && (
              <button
                onClick={() => setActiveTab('before_after')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'before_after'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Before vs After Calibration ({adjustmentResult?.changes?.length || 3} Changes)</span>
              </button>
            )}
          </div>

      {activeTab === 'overview' ? (
        <>
          {/* 2. Three Core Velocity Pillars Pulled Together */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pillar 1: Tasks Finished */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Tasks Finished
                </span>
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {completedTasks}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / {totalTasks} milestones completed
                  </span>
                </div>

                <div className="mt-3 w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                    style={{ width: `${tasksPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Completion: <strong className="text-slate-800 dark:text-slate-200">{tasksPercent}%</strong></span>
                <Link href="/learning-plan" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  View Tasks →
                </Link>
              </div>
            </div>

            {/* Pillar 2: Hours Studied vs Planned */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  2. Hours Studied vs Planned
                </span>
                <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4 shrink-0" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {totalHoursStudied}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / {plannedHours} planned hours
                  </span>
                </div>

                <div className="mt-3 w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isPacingBehind ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${hoursProgressPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className={`font-semibold ${isPacingBehind ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isPacingBehind ? 'Behind Planned Pacing' : 'Pacing On Target'}
                </span>

                <button
                  onClick={() => setLoggedExtraHours(prev => prev + 2)}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+2 hrs</span>
                </button>
              </div>
            </div>

            {/* Pillar 3: Interview Score Trends */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  3. Interview Score Trends
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Trophy className="w-4 h-4 shrink-0" />
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {recentScore !== null ? recentScore : '—'}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / {maxInterviewScore} points{avgInterviewScore !== null ? ` (avg ${avgInterviewScore})` : ''}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
                  {interviews.slice(0, 4).map((inv, idx) => {
                    const sc = inv.rubric?.totalScore || inv.scores?.totalScore || 18;
                    return (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sc >= 21
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : sc >= 17
                            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        Att #{inv.attemptNumber || idx + 1}: {sc}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>{interviews.length} attempts logged</span>
                <Link href="/mock-interview" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  Practice Interview →
                </Link>
              </div>
            </div>
          </div>

          {/* 3. Detailed Week-by-Week Task Execution Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Execution Pacing Checklist
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Week-by-Week Milestone Status ({learningPlan.durationWeeks} Weeks Total)
                </h2>
              </div>

              <div className="text-xs text-slate-500">
                Tick off tasks as you finish to calibrate pacing
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learningPlan.weeks.map((week) => {
                const weekTasksCount = week.tasks?.length || 0;
                const weekDoneCount = week.tasks?.filter(t => t.completed)?.length || 0;
                const isWeekComplete = weekTasksCount > 0 && weekDoneCount === weekTasksCount;

                return (
                  <div
                    key={week.weekNumber}
                    className={`p-4 rounded-xl border transition-all ${
                      isWeekComplete
                        ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          Week {week.weekNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {week.theme}
                        </span>
                      </div>

                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                        {weekDoneCount}/{weekTasksCount}
                      </span>
                    </div>

                    <div className="space-y-2 mt-3">
                      {week.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(week.weekNumber, task.id)}
                          className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={`leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300 font-medium'}`}>
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
      ) : (
        /* 4. Before and After Plan Comparison View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md">
                  Dynamic Adaptation Model
                </span>
                <span className="text-xs text-slate-500">
                  Calibrated to your real study velocity & interview rubric
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Before vs After Plan Calibration
              </h2>
            </div>

            {adjustmentResult && (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleApplyRevisedPlan}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Apply Revised Plan</span>
                </button>
              </div>
            )}
          </div>

          {/* Adaptation Summary Box */}
          {adjustmentResult && (
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
              <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>Executive Calibration Summary</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                {adjustmentResult.summary}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {adjustmentResult.rationale}
              </p>
            </div>
          )}

          {/* What Changed & Why Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              What Changed & Why ({adjustmentResult?.changes?.length || 0} Core Adaptations)
            </h3>

            <div className="space-y-3">
              {(adjustmentResult?.changes || []).map((change, idx) => {
                const badgeColor = 
                  change.type === 'extended' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200' :
                  change.type === 'accelerated' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200' :
                  change.type === 'added_practice' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200' :
                  'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200';

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {change.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Week {change.weekNumber} Adaptation
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {change.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        <strong className="text-slate-700 dark:text-slate-300 not-italic">Why:</strong> {change.reason}
                      </p>
                    </div>

                    <div className="shrink-0 text-right self-start sm:self-center">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-md">
                        Calibrated
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side Before vs After Curriculum View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Left: Previous Plan (Before) */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Baseline Architecture
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Previous Plan ({previousPlan ? previousPlan.durationWeeks : learningPlan.durationWeeks} Weeks)
                  </h4>
                </div>
                <span className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Before
                </span>
              </div>

              <div className="space-y-3">
                {(previousPlan ? previousPlan.weeks : learningPlan.weeks).map((w) => (
                  <div key={w.weekNumber} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Week {w.weekNumber}: {w.theme}</span>
                      <span className="text-slate-400 text-[10px]">{w.hoursNeeded || 10} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      Prove-it Task: {w.proveItTask?.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Revised Plan (After) */}
            <div className="p-5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Optimized Velocity
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Revised Plan ({adjustmentResult ? adjustmentResult.revisedPlan.durationWeeks : learningPlan.durationWeeks} Weeks)
                  </h4>
                </div>
                <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  After (Calibrated)
                </span>
              </div>

              <div className="space-y-3">
                {(adjustmentResult ? adjustmentResult.revisedPlan.weeks : learningPlan.weeks).map((w) => (
                  <div key={w.weekNumber} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-800 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Week {w.weekNumber}: {w.theme}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">{w.hoursNeeded || 10} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                      Prove-it Task: {w.proveItTask?.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
