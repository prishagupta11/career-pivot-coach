'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Send, 
  Plus, 
  Building2, 
  Trash2,
  BarChart3,
  Lightbulb,
  Sparkles,
  MapPin,
  Users,
  Compass,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAppState, saveStoredState } from '@/lib/storage';
import { ApplicationStatus, JobApplication, CompanySize, WorkLocation, ApplicationSource } from '@/types';

interface DimensionStat {
  name: string;
  count: number;
  responseCount: number;
  rate: number;
}

export default function ApplicationsPage() {
  const [state, setState] = useAppState();
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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

  // AI Advice state
  const [adviceData, setAdviceData] = useState<{
    needsMoreData: boolean;
    adviceSentences: string[];
    nextTenApplicationsSuggestion: {
      focusRoleTypes: string[];
      focusCompanySizes: string[];
      focusRemoteTypes: string[];
      focusSources: string[];
      actionPlanText: string;
    };
  } | null>(null);

  const applications = useMemo(() => state?.applications || [], [state]);

  // Counting in code to find which kinds of roles get responses
  // A response is defined as 'Screen' | 'Interview' | 'Offer'
  const isPositiveResponse = (status: ApplicationStatus) => 
    status === 'Screen' || status === 'Interview' || status === 'Offer';

  const totalApplications = applications.length;
  const totalResponses = useMemo(() => 
    applications.filter(a => isPositiveResponse(a.status)).length
  , [applications]);

  const overallResponseRate = totalApplications > 0 
    ? Math.round((totalResponses / totalApplications) * 100) 
    : 0;

  // Generic counting helper
  const calculateBreakdown = useCallback((getKey: (a: JobApplication) => string): DimensionStat[] => {
    const map = new Map<string, { count: number; responseCount: number }>();
    applications.forEach(app => {
      const key = getKey(app) || 'Other';
      const curr = map.get(key) || { count: 0, responseCount: 0 };
      curr.count += 1;
      if (isPositiveResponse(app.status)) {
        curr.responseCount += 1;
      }
      map.set(key, curr);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      responseCount: data.responseCount,
      rate: Math.round((data.responseCount / data.count) * 100)
    })).sort((a, b) => b.rate - a.rate || b.count - a.count);
  }, [applications]);

  const byRoleType = useMemo(() => calculateBreakdown(a => a.roleType), [calculateBreakdown]);
  const byCompanySize = useMemo(() => calculateBreakdown(a => a.companySize), [calculateBreakdown]);
  const byRemote = useMemo(() => calculateBreakdown(a => a.remote), [calculateBreakdown]);
  const bySource = useMemo(() => calculateBreakdown(a => a.source), [calculateBreakdown]);

  // Serialized key to guard useEffect against infinite loop from recreated object references
  const applicationsKey = useMemo(() => {
    return `${applications.length}-${applications.map(a => `${a.id}:${a.status}`).join(',')}`;
  }, [applications]);

  const underThresholdAdvice = useMemo(() => ({
    needsMoreData: true,
    adviceSentences: [
      `We need more data to identify reliable hiring patterns.`,
      `You have logged ${totalApplications} application${totalApplications === 1 ? '' : 's'} so far; logging at least 5 applications will unlock empirical response rate analytics.`,
      `Continue targeting roles closely aligned with your transferable skills to start surfacing meaningful pipeline signals.`
    ],
    nextTenApplicationsSuggestion: {
      focusRoleTypes: [state?.profile?.targetRole || 'Junior Data Analyst', 'Operations Analyst'],
      focusCompanySizes: ['Mid-size (51-250)'],
      focusRemoteTypes: ['Hybrid', 'Remote'],
      focusSources: ['LinkedIn', 'Referral'],
      actionPlanText: `For your next 10 applications, aim for a balanced mix: submit 6 to Mid-size companies where hiring managers read candidate transition narratives, and 4 to local Hybrid roles where candidate competition is lower.`
    }
  }), [totalApplications, state?.profile?.targetRole]);

  const activeAdviceData = totalApplications < 5 ? underThresholdAdvice : (adviceData || underThresholdAdvice);

  // Automatically request Gemini advice when applications change and count >= 5
  useEffect(() => {
    if (!state || totalApplications < 5) return;

    // Call Gemini advice endpoint
    const fetchAdvice = async () => {
      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/ai/application-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalApplications,
            responseCount: totalResponses,
            responseRate: overallResponseRate,
            byRoleType,
            byCompanySize,
            byRemote,
            bySource,
            targetRole: state.profile.targetRole
          })
        });

        const data = await res.json();
        if (res.ok) {
          setAdviceData(data);
        }
      } catch (err) {
        console.error('Error fetching application advice:', err);
      } finally {
        setIsAnalyzing(false);
      }
    };

    fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationsKey, totalApplications, totalResponses, overallResponseRate, state?.profile?.targetRole]);

  if (!state) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        <p>Loading Applications & Response Analytics...</p>
      </div>
    );
  }

  // Add new application
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

    // Reset form
    setCompany('');
    setTitle('');
    setNotes('');
    setIsAdding(false);
  };

  // Update application status
  const handleUpdateStatus = (id: string, newStatus: ApplicationStatus) => {
    const updated = applications.map(a => a.id === id ? { ...a, status: newStatus } : a);
    const updatedState = { ...state, applications: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  // Delete application
  const handleDeleteApp = (id: string) => {
    const updated = applications.filter(a => a.id !== id);
    const updatedState = { ...state, applications: updated };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  // Quick Demo Seeders
  const handleLoadSampleApplications = () => {
    const samples: JobApplication[] = [
      {
        id: `app-sample-1`,
        company: 'HealthMetrics Solutions',
        title: 'Junior Data Analyst',
        roleTitle: 'Junior Data Analyst',
        roleType: 'Data Analyst',
        companySize: 'Mid-size (51-250)',
        remote: 'Hybrid',
        source: 'LinkedIn',
        date: '2026-10-25',
        status: 'Screen',
        notes: 'Recruiter reached out after seeing Tableau Public dashboard.'
      },
      {
        id: `app-sample-2`,
        company: 'RetailScale Commerce',
        title: 'Data Analyst I',
        roleTitle: 'Data Analyst I',
        roleType: 'Data Analyst',
        companySize: 'Enterprise (250+)',
        remote: 'Remote',
        source: 'LinkedIn',
        date: '2026-10-26',
        status: 'Applied',
        notes: 'Requires Power BI and SQL. Submitted portfolio link.'
      },
      {
        id: `app-sample-3`,
        company: 'FinEdge Logistics',
        title: 'Operations Analyst',
        roleTitle: 'Operations Analyst',
        roleType: 'Operations Analyst',
        companySize: 'Mid-size (51-250)',
        remote: 'Remote',
        source: 'Referral',
        date: '2026-10-27',
        status: 'Interview',
        notes: 'First round technical screen scheduled for Thursday.'
      },
      {
        id: `app-sample-4`,
        company: 'CivicData Labs',
        title: 'Junior Research Analyst',
        roleTitle: 'Junior Research Analyst',
        roleType: 'Research Analyst',
        companySize: 'Startup (1-50)',
        remote: 'Remote',
        source: 'Job Board',
        date: '2026-10-15',
        status: 'Rejected',
        notes: 'Heavy Python/R requirement not yet fully met.'
      },
      {
        id: `app-sample-5`,
        company: 'GlobalPeak Financial',
        title: 'Data Analytics Specialist',
        roleTitle: 'Data Analytics Specialist',
        roleType: 'Data Analyst',
        companySize: 'Enterprise (250+)',
        remote: 'On-site',
        source: 'Company Website',
        date: '2026-10-20',
        status: 'Applied',
        notes: 'Corporate finance analytics team. Advanced Excel requirement.'
      },
      {
        id: `app-sample-6`,
        company: 'MedCare Analytics',
        title: 'Healthcare Operations Analyst',
        roleTitle: 'Healthcare Operations Analyst',
        roleType: 'Operations Analyst',
        companySize: 'Mid-size (51-250)',
        remote: 'Hybrid',
        source: 'LinkedIn',
        date: '2026-10-28',
        status: 'Interview',
        notes: 'Loved transferable root-cause analysis and student diagnostic work.'
      }
    ];

    const updatedState = { ...state, applications: samples };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  const handleClearApplications = () => {
    const updatedState = { ...state, applications: [] };
    saveStoredState(updatedState);
    setState(updatedState);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Send className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Empirical Transition Outcomes</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Job Applications & Callback Analytics
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Track company, title, role type, company size, remote setting, source, and interview status. We calculate conversion rates in code to identify which kinds of roles yield responses, and feed the findings directly into your next 10 applications.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{isAdding ? 'Close Application Form' : 'Log New Application'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSampleApplications}
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer w-full text-center"
            >
              Load Demo Applications (6)
            </button>

            {applications.length > 0 && (
              <button
                onClick={handleClearApplications}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Clear all applications to test <5 data threshold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Intelligence Card: 2-3 Plain Advice Sentences & Threshold Rule */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Lightbulb className="w-4 h-4 shrink-0" />
            <span>Pipeline Intelligence & Plain Advice</span>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 px-4 py-2 rounded-xl self-start sm:self-auto">
            <div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                {overallResponseRate}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
                Response Rate ({totalResponses}/{totalApplications})
              </div>
            </div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
            <div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                {totalApplications}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
                Total Logged
              </div>
            </div>
          </div>
        </div>

        {/* Less than 5 applications warning or Plain Advice sentences */}
        {totalApplications < 5 || adviceData?.needsMoreData ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>We need more data to spot reliable patterns ({totalApplications}/5 logged).</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Log at least <strong>5 applications</strong> to reveal statistical response correlations by role type, company size, and remote model. Click &ldquo;Load Demo Applications (6)&rdquo; above to preview live pipeline synthesis.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isAnalyzing ? (
              <div className="p-4 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Synthesizing plain advice from empirical response rates...</span>
              </div>
            ) : activeAdviceData ? (
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Key Pipeline Takeaways (2–3 Plain Sentences)
                </span>
                <ul className="space-y-2">
                  {activeAdviceData.adviceSentences.map((sentence, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{sentence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {/* 3. Feed the advice back as a suggestion for the NEXT TEN applications */}
        {activeAdviceData && !activeAdviceData.needsMoreData && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-indigo-50/70 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Suggestion for Your Next 10 Applications</span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
              {activeAdviceData.nextTenApplicationsSuggestion.actionPlanText}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-500 font-medium">Optimal Targets:</span>
              {activeAdviceData.nextTenApplicationsSuggestion.focusRoleTypes.map((rt, idx) => (
                <span key={idx} className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800 shadow-xs">
                  Role: {rt}
                </span>
              ))}
              {activeAdviceData.nextTenApplicationsSuggestion.focusCompanySizes.map((cs, idx) => (
                <span key={idx} className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 shadow-xs">
                  Size: {cs}
                </span>
              ))}
              {activeAdviceData.nextTenApplicationsSuggestion.focusRemoteTypes.map((rm, idx) => (
                <span key={idx} className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 shadow-xs">
                  {rm}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Counting in Code: Empirical Conversion Breakdown Matrix */}
      {totalApplications > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Breakdown 1: By Role Type */}
          <BreakdownCard
            title="By Role Type"
            items={byRoleType}
            icon={<Compass className="w-3.5 h-3.5" />}
          />

          {/* Breakdown 2: By Company Size */}
          <BreakdownCard
            title="By Company Size"
            items={byCompanySize}
            icon={<Users className="w-3.5 h-3.5" />}
          />

          {/* Breakdown 3: By Remote Setting */}
          <BreakdownCard
            title="By Remote Model"
            items={byRemote}
            icon={<MapPin className="w-3.5 h-3.5" />}
          />

          {/* Breakdown 4: By Source Channel */}
          <BreakdownCard
            title="By Channel Source"
            items={bySource}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
          />
        </div>
      )}

      {/* 5. Add Application Form Modal / Inline Box */}
      {isAdding && (
        <form onSubmit={handleAddApp} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Log Job Application</span>
            </h3>
            <span className="text-xs text-slate-500">All fields feed the pipeline counter</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. HealthMetrics Solutions"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
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
                <option value="Research Analyst">Research Analyst</option>
                <option value="Product Analyst">Product Analyst</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Remote or Not
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Channel Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as ApplicationSource)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral</option>
                <option value="Company Website">Company Website</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Job Board">Job Board</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Application Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Initial Status
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
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Notes / Recruiter Context (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recruiter loved transferable root-cause analysis from teaching"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Save Application
            </button>
          </div>
        </form>
      )}

      {/* 6. Applications Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Application Tracker ({totalApplications} Logged)
            </h2>
            <p className="text-xs text-slate-500">
              Click status to transition through the interview pipeline
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Sorted by date</span>
        </div>

        {totalApplications === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <p>No job applications logged yet.</p>
            <button
              onClick={handleLoadSampleApplications}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Load Demo Applications (6) to see pipeline analytics
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Company & Title</th>
                  <th className="py-3 px-4">Role Type</th>
                  <th className="py-3 px-4">Company Size</th>
                  <th className="py-3 px-4">Remote</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.map((app) => {
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {app.company}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {app.title || app.roleTitle}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {app.roleType || 'Data Analyst'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {app.companySize}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          app.remote === 'Remote' ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300' :
                          app.remote === 'Hybrid' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {app.remote}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {app.source}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {app.date || app.dateApplied}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={app.status}
                          onChange={(e) => handleUpdateStatus(app.id, e.target.value as ApplicationStatus)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
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
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete application"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for conversion breakdown card
function BreakdownCard({
  title,
  items,
  icon
}: {
  title: string;
  items: DimensionStat[];
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Responses</span>
      </div>

      <div className="space-y-2">
        {items.slice(0, 3).map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                {item.name}
              </span>
              <span className={`font-bold ${item.rate >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                {item.rate}% ({item.responseCount}/{item.count})
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.rate >= 60 ? 'bg-emerald-500' : item.rate >= 30 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ width: `${item.rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
