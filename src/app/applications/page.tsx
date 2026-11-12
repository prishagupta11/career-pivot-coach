'use client';

import { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { useAppState, saveStoredState } from '@/lib/storage';
import { ApplicationStatus, JobApplication, CompanySize, WorkLocation, ApplicationSource } from '@/types';

export default function ApplicationsPage() {
  const [state, setState] = useAppState();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form fields
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [roleType, setRoleType] = useState('Data Analyst');
  const [companySize, setCompanySize] = useState<CompanySize>('Mid-size (51-250)');
  const [remote, setRemote] = useState<WorkLocation>('Hybrid');
  const [source, setSource] = useState<ApplicationSource>('LinkedIn');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ApplicationStatus>('Applied');
  const [notes, setNotes] = useState('');

  const applications = useMemo(() => state?.applications || [], [state]);

  const isPositiveResponse = (st: ApplicationStatus) => 
    st === 'Screen' || st === 'Interview' || st === 'Offer';

  const totalApplications = applications.length;
  const totalResponses = useMemo(() => 
    applications.filter(a => isPositiveResponse(a.status)).length
  , [applications]);

  const overallResponseRate = totalApplications > 0 
    ? Math.round((totalResponses / totalApplications) * 100) 
    : 0;

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  const handleAddApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !title.trim()) return;

    const newApp: JobApplication = {
      id: `app-${Date.now()}`,
      company: company.trim(),
      title: title.trim(),
      roleTitle: title.trim(),
      roleType,
      companySize,
      remote,
      source,
      date,
      dateApplied: date,
      status,
      notes: notes.trim()
    };

    const updated = [newApp, ...applications];
    const updatedState = { ...state, applications: updated };
    saveStoredState(updatedState);
    setState(updatedState);

    setCompany('');
    setTitle('');
    setNotes('');
    setIsAdding(false);
  };

  const handleUpdateStatus = (id: string, newStatus: ApplicationStatus) => {
    const updated = applications.map(a => a.id === id ? { ...a, status: newStatus } : a);
    const updatedState = { ...state, applications: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const handleDeleteApp = (id: string) => {
    const updated = applications.filter(a => a.id !== id);
    const updatedState = { ...state, applications: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  // Next-step suggestions (at most 3 short suggestions in a simple list)
  const nextSteps = [
    'Target job postings that closely match your verified skill strengths.',
    'Follow up on applications submitted more than 7 business days ago.',
    'Review interview practice questions for roles moving to the screening stage.'
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Applications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Log job applications and track responses.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
        >
          <Plus size={14} className="shrink-0" />
          <span>{isAdding ? 'Close Form' : 'Log Application'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Applications
          </span>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {totalApplications}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Response Rate
          </span>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {overallResponseRate}% <span className="text-xs font-normal text-slate-400">({totalResponses} responses)</span>
          </div>
        </div>
      </div>

      {/* Next-Step Suggestions (At most 3 short suggestions in a simple list) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Next Steps
        </h2>
        <ul className="space-y-2">
          {nextSteps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
              <CheckCircle2 size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Log Application Form */}
      {isAdding && (
        <form onSubmit={handleAddApp} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Log Job Application
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Junior Data Analyst"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Type
              </label>
              <select
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              >
                <option value="Data Analyst">Data Analyst</option>
                <option value="Operations Analyst">Operations Analyst</option>
                <option value="BI Analyst">BI Analyst</option>
                <option value="Product Manager">Product Manager</option>
                <option value="Customer Success Operations">Customer Success Operations</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Size
              </label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value as CompanySize)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              >
                <option value="Startup (1-50)">Startup (1-50)</option>
                <option value="Mid-size (51-250)">Mid-size (51-250)</option>
                <option value="Enterprise (250+)">Enterprise (250+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Work Mode
              </label>
              <select
                value={remote}
                onChange={(e) => setRemote(e.target.value as WorkLocation)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source Channel
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as ApplicationSource)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral</option>
                <option value="Company Website">Company Website</option>
                <option value="Job Board">Job Board</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-semibold"
              >
                <option value="Applied">Applied</option>
                <option value="Screen">Screen</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recruiter screened on transferable skills"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
            >
              Save Application
            </button>
          </div>
        </form>
      )}

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Logged Applications ({totalApplications})
          </h2>
        </div>

        {totalApplications === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No applications logged yet.</p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>Log Application</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Company & Title</th>
                  <th className="py-3 px-4">Work Mode</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {app.company}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.title || app.roleTitle}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {app.remote}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {app.date || app.dateApplied}
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.id, e.target.value as ApplicationStatus)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          app.status === 'Offer' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                          app.status === 'Interview' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300' :
                          app.status === 'Screen' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300' :
                          app.status === 'Rejected' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300' :
                          'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <option value="Applied">Applied</option>
                        <option value="Screen">Screen</option>
                        <option value="Interview">Interview</option>
                        <option value="Offer">Offer</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteApp(app.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete application"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
