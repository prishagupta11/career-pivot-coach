'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Sparkles, 
  Briefcase, 
  CalendarDays, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  FolderGit2
} from 'lucide-react';
import { useAppState } from '@/lib/storage';

export default function DashboardPage() {
  const [state] = useAppState();

  if (!state) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        Loading Career Pivot Coach...
      </div>
    );
  }

  const { profile, jobPostings, skillGapMap, learningPlan, applications, interviews } = state;

  const totalTasks = (learningPlan?.weeks || []).reduce((acc, w) => acc + (w.tasks?.length || 0), 0);
  const completedTasks = (learningPlan?.weeks || []).reduce((acc, w) => acc + (w.tasks?.filter(t => t.completed)?.length || 0), 0);
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const criticalGaps = (skillGapMap?.skills || []).filter(s => s?.gapSeverity === 'Critical');
  const matchedSkills = (skillGapMap?.skills || []).filter(s => s?.candidateHas);
  const recentInterviewScore = interviews[0]?.rubric?.totalScore || interviews[0]?.scores?.totalScore || 0;
  const maxInterviewScore = interviews[0]?.rubric?.maxScore || (interviews[0]?.scores ? 20 : 25);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* 1. HERO TRANSITION BANNER */}
      <section 
        aria-label="Candidate Overview"
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Side: Candidate & Career Pathway */}
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Active Transition Engine</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {profile.fullName || 'Candidate Profile'}
            </h1>

            {/* Career Pivot Pathway */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs sm:text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                {profile.currentRole || 'Previous Role'}
              </span>
              <ArrowRight size={16} className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800">
                {profile.targetRole || 'Target Role'}
              </span>
            </div>
          </div>

          {/* Right Side: Match KPI Card */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {skillGapMap.overallMatchPercentage || 0}%
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Market Match
              </div>
            </div>

            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 text-right">
              <div className="flex items-center justify-end gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <span>●</span>
                <span><strong className="text-slate-900 dark:text-white">{matchedSkills.length}</strong> Skills Matched</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                <span>▲</span>
                <span><strong className="text-slate-900 dark:text-white">{criticalGaps.length}</strong> Critical Gaps</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. 4-PILLAR STATUS METRIC CARDS */}
      <section 
        aria-label="Key Transition Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch"
      >
        {/* Card 1: Background */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Background
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {(profile?.transferableSkills || []).length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Transferable skills translated
            </p>
          </div>
          <Link 
            href="/profile" 
            className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            <span>Edit Profile</span>
            <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </article>

        {/* Card 2: Job Market */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Job Market
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Briefcase size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {(jobPostings || []).length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real target postings analyzed
            </p>
          </div>
          <Link 
            href="/skill-gaps" 
            className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
          >
            <span>View Skill Gaps</span>
            <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </article>

        {/* Card 3: Learning Plan */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Learning Plan
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <CalendarDays size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {taskProgressPercent}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-purple-600 dark:bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${taskProgressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {completedTasks} of {totalTasks} milestones done
            </p>
          </div>
          <Link 
            href="/learning-plan" 
            className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
          >
            <span>Open Learning Plan</span>
            <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </article>

        {/* Card 4: Outcomes */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Outcomes
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Send size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {recentInterviewScore}/{maxInterviewScore}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mock score across {applications.length} logged apps
            </p>
          </div>
          <Link 
            href="/applications" 
            className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
          >
            <span>Track Applications</span>
            <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </article>
      </section>

      {/* 3. RECOMMENDED NEXT PRIORITY BANNER */}
      <section 
        aria-label="Next Transition Priority"
        className="border-l-4 border-l-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-900/60 px-2.5 py-0.5 rounded-md">
              Recommended Next Priority
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {criticalGaps[0] ? `Focus on High-Frequency Gap: ${criticalGaps[0].skillName}` : 'Set Up Your Profile & Job Postings'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {criticalGaps[0]?.learningSuggestions || criticalGaps[0]?.recommendation || 'Complete your candidate profile and add target job postings to generate personalized next priorities.'}
            </p>
          </div>

          {/* Action buttons with explicit flex container */}
          <div className="flex items-center gap-3 mt-3 shrink-0">
            <Link
              href="/learning-plan"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors whitespace-nowrap"
            >
              Execute Learning Plan
            </Link>
            <Link
              href="/mock-interview"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors whitespace-nowrap"
            >
              Practice Voice Interview
            </Link>
          </div>
        </div>
      </section>

      {/* 4. 2-COLUMN SPLIT: SKILLS VS. GAPS MATRIX */}
      <section 
        aria-label="Skills and Gap Matrix"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left Card: Your Translated Skills */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Your Translated Skills
              </h3>
            </div>
            <Link href="/profile" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {profile.transferableSkills.slice(0, 4).map((skill) => (
              <div 
                key={skill.id} 
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{skill.translatedSkill}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    From: {skill.originalSkill}
                  </div>
                </div>

                <span className="self-start sm:self-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                  {skill.strengthLevel}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Right Card: Top Market Gaps */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Top Market Gaps
              </h3>
            </div>
            <Link href="/skill-gaps" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline">
              View Skill Gaps &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {criticalGaps.slice(0, 4).map((gap) => (
              <div 
                key={gap.id} 
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{gap.skillName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{gap.recommendation}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-semibold shrink-0">
                    Gap
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 shrink-0">
                    In {gap.frequencyPercent}% of postings
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* 5. TARGET CAPSTONE PORTFOLIO PROJECT BANNER */}
      <section 
        aria-label="Target Capstone Project"
        className="bg-slate-900 dark:bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors"
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <FolderGit2 size={16} className="w-4 h-4 shrink-0" />
            <span>Target Capstone Portfolio Project</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {learningPlan.portfolioProject?.title || 'Target Capstone Portfolio Project'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {learningPlan.portfolioProject?.tagline || 'An enterprise-grade portfolio project tailored to your target role.'}
          </p>
          
          {/* Technology / Competency individual tag pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {(learningPlan.portfolioProject?.demonstratedSkills && learningPlan.portfolioProject.demonstratedSkills.length > 0) ? (
              learningPlan.portfolioProject.demonstratedSkills.map((skill, idx) => (
                <span key={idx} className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Generate a learning plan to reveal project milestones.</span>
            )}
          </div>
        </div>

        <Link
          href="/projects"
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors shrink-0 shadow-xs flex items-center justify-center gap-1.5 self-start md:self-center whitespace-nowrap"
        >
          <span>View Project Milestones</span>
          <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </section>

    </div>
  );
}
