'use client';

import { useState } from 'react';
import { 
  FolderGit2, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  Presentation, 
  Copy, 
  Check, 
  CalendarDays, 
  CheckSquare, 
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, PortfolioProjectCard } from '@/types';
import EmptyState from '@/components/EmptyState';

export default function ProjectsPage() {
  const [state, setState] = useAppState();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <span>Loading Portfolio Projects...</span>
        </div>
      </div>
    );
  }

  const { learningPlan, profile } = state;
  const projects: PortfolioProjectCard[] = learningPlan.portfolioProjects || [];

  const handleCopyBullet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setStatusMessage('Copied resume bullet to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setStatusMessage(null);
    }, 2500);
  };

  const handleStatusChange = (id: string, newStatus: 'Not Started' | 'In Progress' | 'Completed') => {
    const updatedProjects = projects.map(p => 
      p.id === id ? { ...p, status: newStatus } : p
    );

    const updatedState: AppState = {
      ...state,
      learningPlan: {
        ...learningPlan,
        portfolioProjects: updatedProjects
      }
    };

    saveStoredState(updatedState);
    setState(updatedState);
  };

  const filteredProjects = projects.filter(p => {
    if (filterStatus === 'all') return true;
    return (p.status || 'Not Started') === filterStatus;
  });

  if (projects.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2">
            <FolderGit2 size={14} className="shrink-0" />
            <span>Verifiable Proof of Competence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Portfolio Projects Roadmap
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Certificates get filtered by ATS; verifiable projects land interviews. Capstone projects prove your critical missing skills, connect directly to your weekly learning plan, and provide ready-to-use resume bullets.
          </p>
        </div>

        <EmptyState
          icon={FolderGit2}
          title="No Portfolio Projects Yet"
          description={
            !profile.targetRole
              ? "Set your target role in Profile, then generate your learning plan to unlock targeted portfolio projects."
              : "Generate your learning plan to reveal targeted portfolio projects tailored to your target role and skill gaps."
          }
          action={
            !profile.targetRole
              ? { label: "Go to Profile", href: "/profile" }
              : { label: "Go to Learning Plan", href: "/learning-plan" }
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2">
              <FolderGit2 size={14} className="shrink-0" />
              <span>Verifiable Proof of Competence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Portfolio Projects Roadmap
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Certificates get filtered by ATS; verifiable projects land interviews. Capstone projects prove your critical missing skills, connect directly to your weekly learning plan, and provide ready-to-use resume bullets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/learning-plan"
              className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              View Learning Plan
            </Link>

            <Link
              href="/mock-interview"
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Presentation size={14} className="shrink-0" />
              <span>Practice Pitch in Interview</span>
            </Link>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Filter and Overview Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Targeted Portfolio Projects Closing Critical Gaps</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Targeting: <strong className="text-indigo-600 dark:text-indigo-400">{profile.targetRole}</strong>
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {['all', 'In Progress', 'Completed', 'Not Started'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterStatus === status
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {status === 'all' ? `All (${projects.length})` : status}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Cards List */}
      <div className="space-y-8">
        {filteredProjects.map((project, idx) => {
          const isCopied = copiedId === project.id;
          const currentStatus = project.status || 'Not Started';

          return (
            <div 
              key={project.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              {/* Card Header: Project Number, Title, Status Selector, Connected Weeks */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Portfolio Project #{idx + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-md">
                      <CalendarDays size={12} className="shrink-0" />
                      <span>{project.connectedWeeks}</span>
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white pt-1">
                    {project.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
                    {project.tagline}
                  </p>
                </div>

                {/* Status Toggle Dropdown */}
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <span className="text-xs text-slate-400">Status:</span>
                  <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(project.id, e.target.value as 'Not Started' | 'In Progress' | 'Completed')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                      currentStatus === 'Completed'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : currentStatus === 'In Progress'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* 2-Column Grid: Problem Solved vs Gaps Closed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Problem it solves */}
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>The Business Problem It Solves</span>
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {project.problemSolved}
                  </p>
                </div>

                {/* 2. Gaps it closes */}
                <div className="p-4 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Market Gaps It Closes</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.gapsClosed.map((gap, gIdx) => (
                      <span
                        key={gIdx}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200/80 dark:border-indigo-800 shadow-2xs"
                      >
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span>{gap}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Step by step what to build */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Step-by-Step What to Build</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {project.stepByStepBuild.map((step, sIdx) => (
                    <div 
                      key={sIdx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800">
                        {sIdx + 1}
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. One-Line Resume Bullet with One-Click Copy */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-transparent border border-purple-200 dark:border-purple-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    Ready-to-Use One-Line Resume Bullet
                  </div>
                  <p className="text-xs text-slate-900 dark:text-white font-mono leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-purple-200/60 dark:border-purple-900/60">
                    &bull; {project.resumeBullet}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyBullet(project.id, `• ${project.resumeBullet}`)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-100 dark:shadow-purple-950'
                  }`}
                >
                  {isCopied ? <Check size={14} className="shrink-0" /> : <Copy size={14} className="shrink-0" />}
                  <span>{isCopied ? 'Copied Bullet!' : 'Copy Resume Bullet'}</span>
                </button>
              </div>

              {/* Card Footer: Connected Week Link and Interview Practice */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  Timeline: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{project.connectedWeeks}</strong>
                </span>

                <div className="flex items-center gap-3">
                  <Link
                    href="/learning-plan"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>View in Learning Plan</span>
                    <ArrowRight size={13} className="shrink-0" />
                  </Link>

                  <Link
                    href="/mock-interview"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Practice Pitch in Interview</span>
                    <ArrowRight size={13} className="shrink-0" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              No portfolio projects matching &ldquo;{filterStatus}&rdquo;.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Generate or reset your learning plan to refresh your recommended capstone projects.
            </p>
            <Link
              href="/learning-plan"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              <span>Go to Learning Plan</span>
              <ArrowRight size={13} className="shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
