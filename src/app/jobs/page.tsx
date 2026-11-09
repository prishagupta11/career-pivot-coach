'use client';

import { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Trash2, 
  Layers, 
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useAppState, saveStoredState } from '@/lib/storage';
import { JobPosting } from '@/types';

export default function JobsPage() {
  const [state, setState] = useAppState();
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newText, setNewText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  if (!state) {
    return <div className="p-12 text-center text-slate-500">Loading Job Postings & Skill Map...</div>;
  }

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCompany.trim() || !newText.trim()) return;

    // Simple skill heuristic for immediate display
    const sampleKeywords = ['SQL', 'Excel', 'Tableau', 'Power BI', 'Python', 'Reporting', 'Communication', 'Modeling', 'ETL', 'AWS'];
    const extracted = sampleKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(newText));

    const newJob: JobPosting = {
      id: `jd-${Date.now()}`,
      title: newTitle.trim(),
      company: newCompany.trim(),
      rawText: newText.trim(),
      extractedSkills: extracted.length > 0 ? extracted : ['Data Analysis', 'Reporting'],
      dateAdded: new Date().toISOString().split('T')[0]
    };

    const updatedJobs = [...state.jobPostings, newJob];
    const updatedState = { ...state, jobPostings: updatedJobs };
    saveStoredState(updatedState);
    setState(updatedState);

    setNewTitle('');
    setNewCompany('');
    setNewText('');
    setIsAdding(false);
  };

  const handleDeleteJob = (id: string) => {
    const updatedJobs = state.jobPostings.filter(j => j.id !== id);
    const updatedState = { ...state, jobPostings: updatedJobs };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const filteredSkills = state.skillGapMap.skills.filter(s => {
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'critical') return s.gapSeverity === 'Critical';
    if (filterSeverity === 'matched') return s.candidateHas;
    return true;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
            <Target className="w-3.5 h-3.5" />
            <span>Step 2: Empirical Market Analysis</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Target Job Postings & Skill Gap Map
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ground your career pivot in empirical job requirements. See which skills are universal across postings vs which ones you already possess.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer self-start md:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? 'Cancel' : 'Add Target Job Description'}</span>
        </button>
      </div>

      {/* Add Job Form Modal/Accordion */}
      {isAdding && (
        <form onSubmit={handleAddJob} className="bg-white rounded-2xl p-6 border border-indigo-200 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Paste Real Job Description</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Job Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Junior Data Analyst"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. HealthMetrics Inc"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Job Description Text</label>
            <textarea
              rows={5}
              required
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Paste the requirements, tools, and responsibilities directly from the job posting..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
            >
              Analyze & Save Job
            </button>
          </div>
        </form>
      )}

      {/* Target Postings Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-600" />
            <span>Target Job Descriptions ({state.jobPostings.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {state.jobPostings.map((job) => (
            <div key={job.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{job.title}</h3>
                    <p className="text-xs text-indigo-600 font-medium">{job.company}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                    title="Remove job"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.extractedSkills.map((skill, idx) => (
                    <span key={idx} className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      {skill}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-slate-500 line-clamp-3 mt-3 leading-relaxed">
                  {job.rawText}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Added {job.dateAdded}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The Empirical Skill Gap Map Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Skill Gap Matrix</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cross-referencing requirements across all {state.jobPostings.length} job postings against your translated candidate profile.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterSeverity === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Skills ({state.skillGapMap.skills.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterSeverity === 'critical' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Critical Gaps
            </button>
            <button
              onClick={() => setFilterSeverity('matched')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterSeverity === 'matched' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Matched Skills
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                <th className="py-3 px-4 rounded-l-xl">Competency / Tool</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Posting Frequency</th>
                <th className="py-3 px-3">Candidate Status</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-4 rounded-r-xl">Actionable Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSkills.map((skill) => (
                <tr key={skill.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {skill.skillName}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {skill.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            skill.frequencyPercent >= 70 ? 'bg-rose-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${skill.frequencyPercent}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-700">{skill.frequencyPercent}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    {skill.candidateHas ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Matched</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Missing</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      skill.gapSeverity === 'Critical'
                        ? 'bg-rose-100 text-rose-800'
                        : skill.gapSeverity === 'Strong'
                        ? 'bg-emerald-100 text-emerald-800'
                        : skill.gapSeverity === 'Good'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {skill.gapSeverity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs leading-relaxed">
                    {skill.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA to Plan */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Identified {state.skillGapMap.criticalGapsCount} critical gaps demanding immediate re-skilling.
          </span>
          <Link
            href="/plan"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
          >
            <span>Proceed to Week-by-Week Learning Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
