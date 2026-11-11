'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Building2, MapPin, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { JobPosting } from '@/types';

interface JobPostingInputProps {
  postings: JobPosting[];
  onChange: (postings: JobPosting[]) => void;
  minRecommended?: number;
}

export default function JobPostingInput({
  postings,
  onChange,
  minRecommended = 3,
}: JobPostingInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('Remote / Hybrid');
  const [rawText, setRawText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !company.trim() || !rawText.trim()) return;

    const newPosting: JobPosting = {
      id: `jd-${Date.now()}`,
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || 'Remote',
      rawText: rawText.trim(),
      extractedSkills: [],
      dateAdded: new Date().toISOString().split('T')[0],
    };

    onChange([...postings, newPosting]);
    setTitle('');
    setCompany('');
    setLocation('Remote / Hybrid');
    setRawText('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    onChange(postings.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Header with counter */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Target Postings Added: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{postings.length}</span>
          {postings.length < minRecommended && (
            <span className="text-slate-400 dark:text-slate-500 ml-1">
              (Aim for at least {minRecommended} for best gap accuracy)
            </span>
          )}
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
          >
            <Plus size={14} className="w-3.5 h-3.5" />
            <span>Add Job Description</span>
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/20 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Paste Target Job Description
            </h4>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme HealthTech"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Junior Data Analyst"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote, Austin TX"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Job Description Text *
            </label>
            <textarea
              required
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste full job requirements, responsibilities, and qualifications..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!company.trim() || !title.trim() || !rawText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Save Posting
            </button>
          </div>
        </form>
      )}

      {/* List of Postings */}
      {postings.length === 0 && !isAdding && (
        <div className="p-6 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 opacity-80" />
          <p className="font-medium text-slate-700 dark:text-slate-300">No job postings added yet.</p>
          <p className="text-[11px] max-w-sm mx-auto">
            Paste postings from LinkedIn, Indeed, or company sites to uncover high-frequency skill requirements.
          </p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs mt-2 cursor-pointer shadow-xs hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            <span>Add First Job Posting</span>
          </button>
        </div>
      )}

      {postings.length > 0 && (
        <div className="space-y-2">
          {postings.map((p, idx) => {
            const isExpanded = expandedId === p.id;
            return (
              <div
                key={p.id || idx}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <span className="flex items-center gap-1">
                          <Building2 size={11} className="shrink-0" />
                          <span>{p.company}</span>
                        </span>
                        {p.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="shrink-0" />
                            <span>{p.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      aria-label="Delete posting"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg">
                    {p.rawText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
