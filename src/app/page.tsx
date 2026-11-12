'use client';

import Link from 'next/link';
import { 
  ArrowRight, 
  Briefcase, 
  CalendarDays, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  FolderGit2,
  Target,
  AudioWaveform
} from 'lucide-react';
import { useAppState } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const [state] = useAppState();
  const { user } = useAuth();

  if (!state) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        Loading...
      </div>
    );
  }

  const { profile, jobPostings, skillGapMap, learningPlan, applications, interviews } = state;

  const totalTasks = (learningPlan?.weeks || []).reduce((acc, w) => acc + (w.tasks?.length || 0), 0);
  const completedTasks = (learningPlan?.weeks || []).reduce((acc, w) => acc + (w.tasks?.filter(t => t.completed)?.length || 0), 0);
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const criticalGaps = (skillGapMap?.skills || []).filter(s => s?.gapSeverity === 'Critical');
  const matchedSkills = (skillGapMap?.skills || []).filter(s => s?.candidateHas);

  const candidateName = profile.fullName?.trim() || user?.displayName || 'Candidate';
  const currentRoleDisplay = profile.currentRole?.trim() || (profile.targetRole ? 'Transitioning Professional' : 'Candidate');

  // Next best action
  let nextAction = {
    title: 'Add Target Job Descriptions to Unlock Skill Gap Map',
    description: 'Add at least 3 job descriptions to map your experience against role requirements.',
    badge: 'Priority 1',
    ctaText: 'Add Job Descriptions',
    ctaHref: '/skill-gaps',
    icon: Target,
  };

  if (jobPostings.length === 0) {
    nextAction = {
      title: 'Add Target Job Descriptions to Unlock Skill Gap Map',
      description: 'Add at least 3 job descriptions to map your experience against role requirements.',
      badge: 'Priority 1',
      ctaText: 'Add Job Descriptions',
      ctaHref: '/skill-gaps',
      icon: Target,
    };
  } else if (!learningPlan?.weeks || learningPlan.weeks.length === 0) {
    nextAction = {
      title: 'Generate Your Custom Learning Curriculum',
      description: 'Your skill gaps have been identified. Generate a week-by-week curriculum tailored to your schedule.',
      badge: 'Priority 2',
      ctaText: 'Generate Learning Plan',
      ctaHref: '/learning-plan',
      icon: CalendarDays,
    };
  } else if (!interviews || interviews.length === 0) {
    nextAction = {
      title: 'Practice Your First Voice Mock Interview',
      description: 'Test your ability to articulate your experience for your target role and get structured feedback.',
      badge: 'Priority 3',
      ctaText: 'Start Voice Interview',
      ctaHref: '/mock-interview',
      icon: AudioWaveform,
    };
  } else {
    nextAction = {
      title: 'Track Your Active Applications',
      description: 'Log your applications to keep track of interview invitations and follow-ups.',
      badge: 'Applications',
      ctaText: 'Open Application Tracker',
      ctaHref: '/applications',
      icon: Send,
    };
  }

  const ActionIcon = nextAction.icon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* 1. HERO TRANSITION BANNER */}
      <section 
        aria-label="Candidate Overview"
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Active Career Pivot</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {candidateName}
            </h1>

            {/* Career Pivot Pathway */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs sm:text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                {currentRoleDisplay}
              </span>
              <ArrowRight size={16} className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
              {profile.targetRole ? (
                <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800">
                  {profile.targetRole}
                </span>
              ) : (
                <Link
                  href="/profile"
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 transition-colors"
                >
                  + Set Target Role
                </Link>
              )}
            </div>
          </div>

          {/* Right Side: Match KPI Card */}
          <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {jobPostings.length === 0 ? 'Pending' : `${skillGapMap.overallMatchPercentage || 0}%`}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {jobPostings.length === 0 ? 'Postings Needed' : 'Match Rate'}
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
                <span><strong className="text-slate-900 dark:text-white">{criticalGaps.length}</strong> Gaps</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. NEXT BEST ACTION CARD */}
      <section 
        aria-label="Next Best Action"
        className="p-5 sm:p-6 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ActionIcon size={20} className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
              <span>{nextAction.badge}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {nextAction.title}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {nextAction.description}
            </p>
          </div>
        </div>

        <Link
          href={nextAction.ctaHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 whitespace-nowrap cursor-pointer"
        >
          <span>{nextAction.ctaText}</span>
          <ArrowRight size={14} className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* 3. 4 STATUS METRIC CARDS */}
      <section 
        aria-label="Key Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch"
      >
        {/* Card 1: Background */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Background
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {(profile?.transferableSkills || []).length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Translated skills
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
                Job Postings
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Briefcase size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {(jobPostings || []).length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Target postings added
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
              {completedTasks} of {totalTasks} tasks done
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
                Applications
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Send size={16} className="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
              {applications.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {applications.length === 1 ? '1 application logged' : `${applications.length} applications logged`}
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

      {/* 4. 2-COLUMN SPLIT: SKILLS VS. GAPS MATRIX */}
      <section 
        aria-label="Skills and Gap Matrix"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left Card: Your Translated Skills */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Translated Skills
            </h3>
            <Link href="/profile" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {profile.transferableSkills.length > 0 ? (
              profile.transferableSkills.slice(0, 4).map((skill) => (
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
                    {skill.category}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <p>No translated skills yet.</p>
                <Link href="/profile" className="mt-2 inline-block font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Add background in Profile &rarr;
                </Link>
              </div>
            )}
          </div>
        </article>

        {/* Right Card: Top Market Gaps */}
        <article className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Missing Skills
              </h3>
            </div>
            <Link href="/skill-gaps" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline">
              View Skill Gaps &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {criticalGaps.length > 0 ? (
              criticalGaps.slice(0, 4).map((gap) => (
                <div 
                  key={gap.id} 
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{gap.skillName}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{gap.reason || gap.recommendation}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-rose-600 dark:text-rose-400 shrink-0 font-medium">
                      In {gap.frequencyPercent}% of postings
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <p>No skill gaps identified yet.</p>
                <Link href="/skill-gaps" className="mt-2 inline-block font-semibold text-rose-600 dark:text-rose-400 hover:underline">
                  Add target job postings &rarr;
                </Link>
              </div>
            )}
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
            <span>Target Capstone Project</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {learningPlan.portfolioProject?.title || 'Target Capstone Portfolio Project'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {learningPlan.portfolioProject?.tagline || 'Generate a learning plan to reveal your recommended capstone project.'}
          </p>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {(learningPlan.portfolioProject?.demonstratedSkills && learningPlan.portfolioProject.demonstratedSkills.length > 0) ? (
              learningPlan.portfolioProject.demonstratedSkills.map((skill, idx) => (
                <span key={idx} className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Generate a learning plan to view project milestones.</span>
            )}
          </div>
        </div>

        <Link
          href={learningPlan.weeks.length > 0 ? "/projects" : "/learning-plan"}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors shrink-0 shadow-xs flex items-center justify-center gap-1.5 self-start md:self-center whitespace-nowrap cursor-pointer"
        >
          <span>{learningPlan.weeks.length > 0 ? "View Project Details" : "Generate Learning Plan"}</span>
          <ArrowRight size={14} className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </section>

    </div>
  );
}
