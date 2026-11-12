'use client';

import { useState } from 'react';
import { 
  Plus, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Trash2,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Quote,
  Save,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useAppState, saveStoredState } from '@/lib/storage';
import { AppState, JobPosting, SkillGapItem, SkillGapMap } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';

export default function SkillGapsPage() {
  const [state, setState] = useAppState();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
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
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const { profile, jobPostings, skillGapMap } = state;

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
  };

  const handleDeleteJobPosting = (id: string) => {
    const updated = state.jobPostings.filter(j => j.id !== id);
    const updatedState = { ...state, jobPostings: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const handleMapMyGaps = async () => {
    if (state.jobPostings.length === 0) {
      setStatusMessage({
        text: 'Please add at least one job posting first.',
        type: 'error'
      });
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const res = await apiFetch('/api/ai/map-skill-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: state.profile,
          transferableSkills: state.profile.transferableSkills || [],
          jobPostings: state.jobPostings
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      const updatedSkillGapMap: SkillGapMap = {
        overallMatchPercentage: typeof data.overallMatchPercentage === 'number' ? data.overallMatchPercentage : 0,
        criticalGapsCount: typeof data.criticalGapsCount === 'number' ? data.criticalGapsCount : (data.skills || []).filter((s: SkillGapItem) => s.gapSeverity === 'Critical').length,
        skills: data.skills || [],
        lastAnalyzed: data.lastAnalyzed || new Date().toISOString(),
      };

      const updatedState: AppState = {
        ...state,
        skillGapMap: updatedSkillGapMap
      };

      saveStoredState(updatedState);
      setState(updatedState);
    } catch {
      setStatusMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToProfile = () => {
    saveStoredState(state);
    setSavedSuccessBanner(true);
    setTimeout(() => setSavedSuccessBanner(false), 3000);
  };

  const skillsList = skillGapMap.skills || [];
  const criticalGapsCount = skillsList.filter(s => s.matchStatus === 'lacks').length;
  const matchedSkillsCount = skillsList.filter(s => s.matchStatus === 'has').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Skill Gaps</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare your skills against target job postings.
          </p>
        </div>

        {/* ONE clear AI action: "Map skill gaps" */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleMapMyGaps}
            disabled={isAnalyzing || jobPostings.length === 0}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isAnalyzing && <RefreshCw size={14} className="animate-spin shrink-0" />}
            <span>Map skill gaps</span>
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
          <span>Saved successfully.</span>
        </div>
      )}

      {isAnalyzing && (
        <AILoadingIndicator />
      )}

      {/* Job Postings Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Job Postings ({jobPostings.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingPosting(!isAddingPosting)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={14} className="shrink-0" />
            <span>{isAddingPosting ? 'Cancel' : 'Add Posting'}</span>
          </button>
        </div>

        {/* Add Job Form */}
        {isAddingPosting && (
          <form onSubmit={handleAddJobPosting} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Job Title</label>
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Remote"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Description
              </label>
              <textarea
                rows={5}
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Paste the job requirements and responsibilities..."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2">
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
                Save
              </button>
            </div>
          </form>
        )}

        {/* Postings Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobPostings.map((job, idx) => (
            <div 
              key={job.id} 
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteJobPosting(job.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
                  >
                    <Trash2 size={13} className="shrink-0" />
                  </button>
                </div>

                <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{job.title}</h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                  <Building2 size={12} className="shrink-0" />
                  <span>{job.company}</span>
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mt-2 leading-relaxed">
                  {job.rawText}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-400">
                {job.location || 'Remote'}
              </div>
            </div>
          ))}

          {jobPostings.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Briefcase}
                title="No Job Postings Added"
                description={
                  !profile.targetRole
                    ? "Set your target role in Profile first, then add job descriptions to compare requirements."
                    : `Add target job postings for ${profile.targetRole} to map your skill gaps.`
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
      </div>

      {/* Results Overview */}
      {skillsList.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Skill Gaps Not Mapped Yet"
          description={
            jobPostings.length === 0
              ? "Add at least one job posting above, then click Map skill gaps."
              : "Job postings added. Click Map skill gaps above to analyze your match."
          }
          action={
            jobPostings.length > 0
              ? { label: isAnalyzing ? "Working on it..." : "Map skill gaps", onClick: handleMapMyGaps, disabled: isAnalyzing }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Match
              </span>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {skillGapMap.overallMatchPercentage}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Missing Skills
              </span>
              <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {criticalGapsCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Matched Skills
              </span>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {matchedSkillsCount}
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Skill Breakdown
            </h2>

            <div className="space-y-3">
              {skillsList.map((skill) => (
                <div 
                  key={skill.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {skill.skillName}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {skill.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {skill.matchStatus === 'lacks' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>Missing</span>
                        </span>
                      )}
                      {skill.matchStatus === 'partly' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                          <HelpCircle size={12} className="shrink-0" />
                          <span>Partial</span>
                        </span>
                      )}
                      {skill.matchStatus === 'has' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          <CheckCircle2 size={12} className="shrink-0" />
                          <span>Matched</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {skill.provenPhrase && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5 pt-1">
                      <Quote size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="italic">&ldquo;{skill.provenPhrase}&rdquo;</span>
                    </div>
                  )}

                  {skill.reason && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {skill.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveToProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Save size={14} className="shrink-0" />
                <span>Save</span>
              </button>

              <Link
                href="/learning-plan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
              >
                <span>Continue to Learning Plan</span>
                <ArrowRight size={14} className="shrink-0" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
