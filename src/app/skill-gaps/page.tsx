'use client';

import { useState } from 'react';
import { 
  Target, 
  Plus, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Trash2,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Quote,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Save,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, JobPosting, SkillGapItem, SkillGapMap } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';

export default function SkillGapsPage() {
  const [state, setState] = useAppState();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [savedSuccessBanner, setSavedSuccessBanner] = useState(false);

  // New posting form
  const [isAddingPosting, setIsAddingPosting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newLocation, setNewLocation] = useState('Remote / Hybrid');
  const [newText, setNewText] = useState('');

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <RefreshCw className="animate-spin text-indigo-600" size={16} />
          <span>Loading Skill Gap Map...</span>
        </div>
      </div>
    );
  }

  const { profile, jobPostings, skillGapMap } = state;

  // Toggle skill card expansion for context and learning suggestions
  const toggleSkillExpand = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 2. Add New Custom Job Posting
  const handleAddJobPosting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCompany.trim() || !newText.trim()) return;

    const newPosting: JobPosting = {
      id: `jd-${Date.now()}`,
      title: newTitle.trim(),
      company: newCompany.trim(),
      location: newLocation.trim() || 'Remote',
      rawText: newText.trim(),
      extractedSkills: [],
      dateAdded: new Date().toISOString().split('T')[0]
    };

    const updatedPostings = [...state.jobPostings, newPosting];
    const updatedState = { ...state, jobPostings: updatedPostings };
    saveStoredState(updatedState);
    setState(updatedState);

    setNewTitle('');
    setNewCompany('');
    setNewText('');
    setIsAddingPosting(false);
    setStatusMessage({
      text: `Added job posting from ${newPosting.company}. You now have ${updatedPostings.length} postings ready to analyze.`,
      type: 'success'
    });
  };

  // 3. Delete Job Posting
  const handleDeleteJobPosting = (id: string) => {
    const updated = state.jobPostings.filter(j => j.id !== id);
    const updatedState = { ...state, jobPostings: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  // 4. Map My Gaps - Send profile, translated skills, and postings to Gemini
  const handleMapMyGaps = async () => {
    if (state.jobPostings.length === 0) {
      setStatusMessage({
        text: 'Please paste at least one target job posting first.',
        type: 'error'
      });
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const res = await fetch('/api/ai/map-skill-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: state.profile,
          transferableSkills: state.profile.transferableSkills || [],
          jobPostings: state.jobPostings
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.friendlyMessage || data.error || 'Failed to map skill gaps');

      const updatedSkillGapMap: SkillGapMap = {
        overallMatchPercentage: typeof data.overallMatchPercentage === 'number' ? data.overallMatchPercentage : 0,
        criticalGapsCount: typeof data.criticalGapsCount === 'number' ? data.criticalGapsCount : (data.skills || []).filter((s: SkillGapItem) => s.gapSeverity === 'Critical').length,
        skills: data.skills || [],
        lastAnalyzed: data.lastAnalyzed || new Date().toISOString(),
        retried: data.retried,
        source: data.source,
        friendlyMessage: data.friendlyMessage
      };

      const updatedState: AppState = {
        ...state,
        skillGapMap: updatedSkillGapMap
      };

      // Save to localStorage and update profile
      saveStoredState(updatedState);
      setState(updatedState);

      // Auto expand the top 2 missing skills so the user immediately sees the proof quote and how to learn
      const topIds: Record<string, boolean> = {};
      updatedSkillGapMap.skills.slice(0, 2).forEach((s: SkillGapItem) => {
        topIds[s.id] = true;
      });
      setExpandedDetails(topIds);

      setStatusMessage({
        text: `Skill Gap Map successfully generated! Identified ${updatedSkillGapMap.criticalGapsCount} critical missing gaps and ${updatedSkillGapMap.skills.filter((s: SkillGapItem) => s.matchStatus === 'has').length} verified strengths. Updated in your profile.`,
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error mapping skill gaps';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Manual save button
  const handleSaveToProfile = () => {
    saveStoredState(state);
    setSavedSuccessBanner(true);
    setStatusMessage({ text: 'Skill Gap Map and candidate profile saved to workspace.', type: 'success' });
    setTimeout(() => setSavedSuccessBanner(false), 4000);
  };

  // Skills are already canonically sorted by the API (lacks -> partly -> has, by frequencyPercent)
  const skillsList = skillGapMap.skills || [];

  const filteredSkills = skillsList.filter(skill => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'lacks') return skill.matchStatus === 'lacks';
    if (filterStatus === 'partly') return skill.matchStatus === 'partly';
    if (filterStatus === 'has') return skill.matchStatus === 'has';
    return true;
  });

  const criticalGapsCount = (skillGapMap?.skills || []).filter(s => s.matchStatus === 'lacks').length;
  const partlyGapsCount = (skillGapMap?.skills || []).filter(s => s.matchStatus === 'partly').length;
  const matchedSkillsCount = (skillGapMap?.skills || []).filter(s => s.matchStatus === 'has').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2">
              <Target size={14} className="shrink-0" />
              <span>Phase 4: Empirical Skill Gap Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Target Job Descriptions & Skill Gap Map
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Paste 3 to 5 real job postings. We extract the exact competencies employers demand, verify them with direct quotes from the postings, and rank your most urgent skill gaps with colored demand bars.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleMapMyGaps}
              disabled={isAnalyzing || jobPostings.length === 0}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-all cursor-pointer shadow-md shadow-indigo-100 dark:shadow-indigo-950"
            >
              {isAnalyzing ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Sparkles size={14} className="shrink-0" />}
              <span>{isAnalyzing ? 'Mapping Your Gaps...' : 'Map My Gaps'}</span>
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
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        {savedSuccessBanner && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>Skill Gap Map saved! Updated in your profile and synced across your workspace.</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Analyzing Loading State */}
      {isAnalyzing && (
        <AILoadingIndicator
          title="AI Gap Mapping Engine Active"
          stages={[
            "Reading target job postings & role requirements...",
            "Extracting exact employer requirements & direct proof quotes...",
            "Cross-referencing candidate background & translated competencies...",
            "Calculating posting frequencies & ranking most critical gaps first..."
          ]}
        />
      )}

      {/* SECTION 1: Job Postings Intake (Paste 3 to 5 Serial Postings) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>1. Target Job Postings Intake</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste 3 to 5 serial job descriptions from your target industry to identify real employer patterns.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              jobPostings.length >= 3 
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {jobPostings.length} of 3-5 Postings Added
            </span>

            <button
              type="button"
              onClick={() => setIsAddingPosting(!isAddingPosting)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={14} className="shrink-0" />
              <span>{isAddingPosting ? 'Close Form' : 'Paste New Posting'}</span>
            </button>
          </div>
        </div>

        {/* Add Job Form */}
        {isAddingPosting && (
          <form onSubmit={handleAddJobPosting} className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Paste Target Job Description</span>
              </h3>
              <span className="text-xs text-slate-400">Step: Add title, company, and raw text</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Stripe, HealthMetrics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Job Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Junior Data Analyst"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Location / Format</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Remote / Hybrid / NYC"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Description Text (Requirements, Responsibilities, Bullets)
              </label>
              <textarea
                rows={5}
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Paste the full job posting text: 'Requirements: 1-2 years experience, strong SQL queries, Tableau dashboards, advanced Excel...'"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingPosting(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Job Posting
              </button>
            </div>
          </form>
        )}

        {/* Postings Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {jobPostings.map((job, idx) => (
            <div 
              key={job.id} 
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Posting #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteJobPosting(job.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
                    title="Delete job posting"
                  >
                    <Trash2 size={13} className="shrink-0" />
                  </button>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{job.title}</h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                  <Building2 size={12} className="shrink-0" />
                  <span>{job.company}</span>
                </p>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-4 mt-2.5 leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
                  {job.rawText}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-400 flex items-center justify-between">
                <span>{job.location || 'Remote'}</span>
                <span>{job.rawText.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>
          ))}

          {jobPostings.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Briefcase}
                title="No Target Job Postings Added"
                description={
                  !profile.targetRole
                    ? "Set your target role in Profile first, then add 2–4 job descriptions to analyze real employer requirements."
                    : `Add 2–4 target job postings for ${profile.targetRole} to map market demand and reveal your skill gaps.`
                }
                action={
                  !profile.targetRole
                    ? { label: "Go to Profile", href: "/profile" }
                    : { label: "Add Job Description", onClick: () => setIsAddingPosting(true) }
                }
              />
            </div>
          )}
        </div>

        {/* Primary Map My Gaps Trigger Banner */}
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Ready to Cross-Reference With Your Background?</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Click &ldquo;Map My Gaps&rdquo; to send candidate profile, translated skills, and the {jobPostings.length} postings to AI.
            </p>
          </div>

          <button
            type="button"
            onClick={handleMapMyGaps}
            disabled={isAnalyzing || jobPostings.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-all cursor-pointer shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0"
          >
            {isAnalyzing ? <RefreshCw size={15} className="animate-spin shrink-0" /> : <Layers size={15} className="shrink-0" />}
            <span>{isAnalyzing ? 'Mapping Skill Gaps...' : 'Map My Gaps Now'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 2 & 3: Metric Cards Overview & Ranked Skill Gap Matrix */}
      {skillGapMap.skills.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Skill Gap Map Not Analyzed Yet"
          description={
            jobPostings.length === 0
              ? "Add at least one target job posting above, then click Map My Gaps to evaluate your skills against real market demand."
              : "Job postings added! Click \"Map My Gaps Now\" above to analyze your skill match and highlight critical gaps."
          }
          action={
            jobPostings.length > 0
              ? { label: isAnalyzing ? "Mapping Gaps..." : "Map My Gaps Now", onClick: handleMapMyGaps, disabled: isAnalyzing }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Match Percentage */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overall Market Match
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {skillGapMap.overallMatchPercentage}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Across {jobPostings.length} target job descriptions
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Target size={24} className="shrink-0" />
          </div>
        </div>

        {/* Critical Missing Gaps */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-rose-200 dark:border-rose-900/50 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Critical Missing Gaps
            </span>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {criticalGapsCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ranked first for your learning plan
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <AlertCircle size={24} className="shrink-0" />
          </div>
        </div>

        {/* Verified Strengths & Bridgeable */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-900/50 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Verified Strengths
            </span>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {matchedSkillsCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {partlyGapsCount} additional partial / bridgeable skills
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 size={24} className="shrink-0" />
          </div>
        </div>
      </div>

      {/* SECTION 3: The Ranked Skill Gap Matrix (Most Demanded Missing Skills at Top) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Skill Gap Map (Ranked by Demand & Gap Urgency)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              The most demanded missing skills appear at the top with colored bars. Each skill shows authentic proof quotes and learning steps.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All Skills ({skillGapMap.skills.length})
            </button>
            <button
              onClick={() => setFilterStatus('lacks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterStatus === 'lacks'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'
              }`}
            >
              Lacks It ({criticalGapsCount})
            </button>
            <button
              onClick={() => setFilterStatus('partly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterStatus === 'partly'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              Partly Has It ({partlyGapsCount})
            </button>
            <button
              onClick={() => setFilterStatus('has')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                filterStatus === 'has'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
              }`}
            >
              Has It ({matchedSkillsCount})
            </button>
          </div>
        </div>

        {/* Skill Gap Cards List */}
        <div className="space-y-4">
          {filteredSkills.map((skill) => {
            const isExpanded = !!expandedDetails[skill.id];

            return (
              <div 
                key={skill.id}
                className={`p-5 rounded-2xl border transition-all ${
                  skill.matchStatus === 'lacks'
                    ? 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/15 dark:bg-rose-950/10 hover:border-rose-300'
                    : skill.matchStatus === 'partly'
                    ? 'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/15 dark:bg-amber-950/10 hover:border-amber-300'
                    : 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/15 dark:bg-emerald-950/10 hover:border-emerald-300'
                }`}
              >
                {/* Header Row: Skill Name, Badges, Expand Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {skill.skillName}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {skill.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status Badge: Lacks it, Partly has it, Has it */}
                    {skill.matchStatus === 'lacks' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>Lacks It</span>
                      </span>
                    )}
                    {skill.matchStatus === 'partly' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <HelpCircle size={13} className="shrink-0" />
                        <span>Partly Has It</span>
                      </span>
                    )}
                    {skill.matchStatus === 'has' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>Has It</span>
                      </span>
                    )}

                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      skill.gapSeverity === 'Critical'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : skill.gapSeverity === 'Strong'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                    }`}>
                      {skill.gapSeverity}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleSkillExpand(skill.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
                      title={isExpanded ? 'Collapse details' : 'Expand how to learn & skill context'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Colored Demand Bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Posting Frequency: {skill.postingsCount || Math.round((skill.frequencyPercent / 100) * jobPostings.length)} of {skill.totalPostings || jobPostings.length} postings
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {skill.frequencyPercent}% Demand
                    </span>
                  </div>

                  {/* Colored progress bar */}
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        skill.matchStatus === 'lacks'
                          ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                          : skill.matchStatus === 'partly'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      }`}
                      style={{ width: `${Math.max(skill.frequencyPercent, 8)}%` }}
                    />
                  </div>
                </div>

                {/* Proof Quote From Posting (Nothing Looks Invented) */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-3">
                  <div className="flex items-start gap-2.5">
                    <Quote size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-0.5">
                        Direct Evidence From Job Posting
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 italic font-mono leading-relaxed">
                        &ldquo;{skill.provenPhrase || 'Identified across job requirements'}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Match Reason */}
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">Candidate Status Rationale: </strong>
                  <span>{skill.reason}</span>
                </div>

                {/* Expandable Section: Skill Information & How to Learn */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Information about the skill */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1.5">
                        <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>About This Skill in {profile.targetRole || 'Target Role'}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {skill.skillContext || 'Industry standard competency required across modern analytics and transition roles.'}
                      </p>
                    </div>

                    {/* How the person can learn this skill */}
                    <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200 mb-1.5">
                        <Lightbulb size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>How You Can Learn & Bridge This Skill</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {skill.learningSuggestions || skill.recommendation || 'Focus on hands-on project implementations.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Expand/Collapse Toggle Button */}
                <div className="mt-2 flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => toggleSkillExpand(skill.id)}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Hide learning roadmap & skill context' : 'Show how to learn & skill context'}</span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  <span className="text-[10px] text-slate-400">
                    Category: {skill.category}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredSkills.length === 0 && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No skills matching the current filter ({filterStatus}).
              </p>
            </div>
          )}
        </div>

        {/* SECTION 4: Save & Forward to Learning Plan */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Skill Gaps Mapped & Updated in Profile</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              These {criticalGapsCount} critical missing gaps will directly seed your custom week-by-week learning plan and portfolio project.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveToProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Save size={14} className="shrink-0" />
              <span>Save Map</span>
            </button>

            <Link
              href="/learning-plan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            >
              <span>Proceed to Learning Plan</span>
              <ArrowRight size={14} className="shrink-0" />
            </Link>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
