'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppState, saveStoredState } from '@/lib/storage';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useResumeUpload } from '@/hooks/useResumeUpload';
import { useProfileExtraction, ExtractedProfileResult } from '@/hooks/useProfileExtraction';
import TagInput from '@/components/TagInput';
import JobPostingInput from '@/components/JobPostingInput';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Mic,
  MicOff,
  UploadCloud,
  FileText,
  Sparkles,
  AlertCircle,
  Clock,
  CalendarDays,
  Edit3,
  LogOut,
  X
} from 'lucide-react';
import { AppState, JobPosting } from '@/types';

const TOTAL_STEPS = 8;

const STEP_TITLES = [
  'Welcome',
  'Your Current Background',
  'Where You Want to Go',
  'Tell Us Your Story',
  'What You Already Know',
  'Target Job Postings',
  'Your Commitment',
  'Review & Launch',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [state, setState] = useAppState();

  // Wizard Navigation State initialized from stored onboarding step
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const savedStep = state?.onboarding?.currentStep;
    if (typeof savedStep === 'number' && savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      return savedStep;
    }
    return 1;
  });

  const [saveLaterModalOpen, setSaveLaterModalOpen] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1: Welcome & Name
  const [fullName, setFullName] = useState(() => state?.profile?.fullName || user?.displayName || '');

  // Step 2: Background
  const [currentRole, setCurrentRole] = useState(() => state?.profile?.currentRole || '');
  const [industry, setIndustry] = useState('');
  const [yearsExperience, setYearsExperience] = useState<number>(() => {
    const yr = state?.profile?.yearsExperience;
    return typeof yr === 'number' && yr > 0 ? yr : 3;
  });

  // Step 3: Target Role & Timeline
  const [targetRole, setTargetRole] = useState(() => state?.profile?.targetRole || '');
  const [targetTimeline, setTargetTimeline] = useState(() => state?.profile?.preferences?.targetTimeline || '3 - 6 months');

  // Step 4: Story Narrative / Speech / Resume
  const [storyInputMode, setStoryInputMode] = useState<'type' | 'voice' | 'resume'>('voice');
  const [narrativeText, setNarrativeText] = useState(() => state?.profile?.rawSpeech || state?.profile?.cleanedSpeech || '');
  const [storyReviewMode, setStoryReviewMode] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedProfileResult | null>(null);

  // Step 5: What you already know
  const [skills, setSkills] = useState<string[]>(() => state?.profile?.skills || []);
  const [tools, setTools] = useState<string[]>(() => state?.profile?.tools || []);

  // Step 6: Target Job Postings
  const [postings, setPostings] = useState<JobPosting[]>(() => state?.jobPostings || []);
  const [skippedPostings, setSkippedPostings] = useState(false);

  // Step 7: Commitment & Preferences
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(() => state?.learningPlan?.hoursPerWeek || 10);
  const [durationWeeks, setDurationWeeks] = useState<number>(() => state?.learningPlan?.durationWeeks || 4);
  const [workMode, setWorkMode] = useState<'remote' | 'hybrid' | 'onsite'>(() => {
    const mode = state?.profile?.preferences?.workMode;
    return (mode === 'hybrid' || mode === 'onsite') ? mode : 'remote';
  });
  const [preferredLocation, setPreferredLocation] = useState(() => state?.profile?.preferences?.preferredLocation || '');

  // Step 8: Final Generation Pipeline Loading
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);

  // Hooks for Speech, Resume Upload, Extraction
  const { isRecording, toggleRecording } = useSpeechRecognition((chunk) => {
    setNarrativeText((prev) => (prev ? `${prev} ${chunk}` : chunk));
  });

  const { isUploading, uploadError, parseResumeFile } = useResumeUpload();
  const { isExtracting, extractProfile } = useProfileExtraction();

  // Synchronize and persist state after each step
  const persistCurrentProgress = (nextStepNumber?: number) => {
    const updatedState: AppState = {
      ...state,
      profile: {
        ...state.profile,
        fullName: fullName.trim(),
        currentRole: currentRole.trim(),
        targetRole: targetRole.trim(),
        yearsExperience,
        rawSpeech: narrativeText.trim(),
        skills,
        tools,
        preferences: {
          ...state.profile.preferences,
          targetTimeline,
          workMode,
          preferredLocation: preferredLocation.trim(),
        },
        lastUpdated: new Date().toISOString(),
      },
      jobPostings: postings,
      learningPlan: {
        ...state.learningPlan,
        hoursPerWeek,
        durationWeeks,
      },
      onboarding: {
        completed: false,
        currentStep: nextStepNumber ?? currentStep,
        completedAt: null,
      },
    };

    saveStoredState(updatedState);
    setState(updatedState);
  };

  // Validation before advancing
  const validateStep = (step: number): boolean => {
    setStepError(null);

    switch (step) {
      case 1:
        if (!fullName.trim()) {
          setStepError('Please enter your full name to personalize your transition artifacts.');
          return false;
        }
        return true;
      case 2:
        if (!currentRole.trim()) {
          setStepError('Please enter your current or most recent role.');
          return false;
        }
        return true;
      case 3:
        if (!targetRole.trim()) {
          setStepError('Please select or specify your target career role.');
          return false;
        }
        return true;
      case 4:
        if (!narrativeText.trim()) {
          setStepError('Please share your background story by speaking, uploading a resume, or typing.');
          return false;
        }
        return true;
      case 5:
      case 6:
      case 7:
        return true;
      default:
        return true;
    }
  };

  // Step 4: Run Extraction and Transition to Review
  const handleExtractAndReview = async () => {
    if (!validateStep(4)) return;

    try {
      const data = await extractProfile({
        narrativeText,
        currentRole,
        targetRole,
        yearsExperience,
        knownSkills: [...skills, ...tools].join(', '),
      });

      setExtractedData(data);

      // Merge extracted skills and tools into state
      if (data.skills && data.skills.length > 0) {
        setSkills((prev) => Array.from(new Set([...prev, ...(data.skills || [])])));
      }
      if (data.tools && data.tools.length > 0) {
        setTools((prev) => Array.from(new Set([...prev, ...(data.tools || [])])));
      }

      setStoryReviewMode(true);
    } catch {
      // Error handled by hook
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    // Step 4 special flow: If in story input mode and hasn't reviewed extraction yet, run extraction first
    if (currentStep === 4 && !storyReviewMode) {
      await handleExtractAndReview();
      return;
    }

    const nextStep = currentStep + 1;
    if (nextStep <= TOTAL_STEPS) {
      setCurrentStep(nextStep);
      setStoryReviewMode(false);
      persistCurrentProgress(nextStep);
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep === 4 && storyReviewMode) {
      setStoryReviewMode(false);
      return;
    }
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      persistCurrentProgress(prevStep);
    }
  };

  // Step 8: Build my plan & finalize onboarding
  const handleBuildPlanAndLaunch = async () => {
    setIsBuildingPlan(true);

    const currentState = { ...state };

    try {
      // 1. Ensure profile is saved with latest values
      currentState.profile = {
        ...currentState.profile,
        fullName: fullName.trim(),
        currentRole: currentRole.trim(),
        targetRole: targetRole.trim(),
        yearsExperience,
        rawSpeech: narrativeText.trim(),
        skills,
        tools,
        preferences: {
          targetTimeline,
          workMode,
          preferredLocation: preferredLocation.trim(),
        },
        lastUpdated: new Date().toISOString(),
      };
      currentState.jobPostings = postings;
      currentState.learningPlan = {
        ...currentState.learningPlan,
        hoursPerWeek,
        durationWeeks,
      };

      // 2. Map Skill Gaps (if postings exist)
      if (postings.length > 0) {
        try {
          const mapRes = await fetch('/api/ai/map-skill-gaps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: currentState.profile,
              transferableSkills: currentState.profile.transferableSkills || [],
              jobPostings: currentState.jobPostings,
            }),
          });
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            currentState.skillGapMap = {
              overallMatchPercentage: typeof mapData.overallMatchPercentage === 'number' ? mapData.overallMatchPercentage : 0,
              criticalGapsCount: Array.isArray(mapData.skills)
                ? mapData.skills.filter((s: { gapSeverity: string }) => s.gapSeverity === 'Critical').length
                : 0,
              skills: mapData.skills || [],
              lastAnalyzed: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.warn('Skill gap mapping error during onboarding:', e);
        }
      }

      // 3. Generate Learning Plan
      try {
        const planRes = await fetch('/api/ai/generate-learning-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hoursPerWeek,
            durationWeeks,
            skillGaps: currentState.skillGapMap?.skills || [],
            profile: currentState.profile,
          }),
        });
        if (planRes.ok) {
          const planData = await planRes.json();
          currentState.learningPlan = {
            durationWeeks: planData.durationWeeks || durationWeeks,
            hoursPerWeek: planData.hoursPerWeek || hoursPerWeek,
            weeks: planData.weeks || [],
            portfolioProject: currentState.learningPlan.portfolioProject,
            portfolioProjects: planData.portfolioProjects || currentState.learningPlan.portfolioProjects,
            lastGenerated: new Date().toISOString(),
          };
        }
      } catch (e) {
        console.warn('Learning plan generation error during onboarding:', e);
      }

      // Mark onboarding completed
      currentState.onboarding = {
        completed: true,
        currentStep: TOTAL_STEPS,
        completedAt: new Date().toISOString(),
      };

      saveStoredState(currentState);
      setState(currentState);

      // Transition to dashboard
      router.replace('/');
    } catch (err) {
      console.warn('Setup launch error:', err);
      // Let user continue anyway rather than blocking them
      currentState.onboarding = {
        completed: true,
        currentStep: TOTAL_STEPS,
        completedAt: new Date().toISOString(),
      };
      saveStoredState(currentState);
      setState(currentState);
      router.replace('/');
    } finally {
      setIsBuildingPlan(false);
    }
  };

  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Top Header & Progress Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Compass size={18} className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight block">
                Career Pivot Coach
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block -mt-0.5">
                Setup Wizard • Step {currentStep} of {TOTAL_STEPS}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                persistCurrentProgress();
                setSaveLaterModalOpen(true);
              }}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Save & continue later
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Wizard Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-3xl w-full mx-auto">
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-6">
          
          {/* Step Category Badge */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>Step {currentStep}</span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span>{STEP_TITLES[currentStep - 1]}</span>
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Validation Notice Banner */}
          {stepError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{stepError}</span>
            </div>
          )}

          {/* ================= STEP 1: WELCOME ================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  We’re going to translate your existing professional background into the currency of your target domain, identify exact skill gaps, and build your custom portfolio blueprint.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Confirm Your Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  This name will appear on your generated portfolio blueprints, mock interview scorecards, and resumes.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 2: CURRENT BACKGROUND ================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Your Current Background
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Where are you pivoting from? Hiring managers view past titles through an orthodox lens; we’ll bridge that gap.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Current or Most Recent Role *
                  </label>
                  <input
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder="e.g. High School Math Teacher, Financial Auditor, Store Manager"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  
                  {/* Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400">Quick select:</span>
                    {[
                      'High School Teacher',
                      'Financial Auditor',
                      'Operations Supervisor',
                      'Customer Service Lead',
                      'Hospitality Manager',
                    ].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setCurrentRole(role)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Industry / Sector
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. K-12 Education, Accounting & Finance, Retail, Healthcare"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Total Years of Professional Experience
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '1 - 2 yrs', val: 2 },
                      { label: '3 - 5 yrs', val: 4 },
                      { label: '6 - 9 yrs', val: 7 },
                      { label: '10+ yrs', val: 10 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setYearsExperience(preset.val)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          yearsExperience === preset.val
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: WHERE YOU WANT TO GO ================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Where You Want to Go
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Select your target destination. We calibrate your skill translations and portfolio against standard industry expectations for this title.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Role Title *
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Junior Data Analyst"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />

                  {/* High-frequency Pivot Roles */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Popular transition roles:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Junior Data Analyst',
                        'Product Manager',
                        'Customer Success Operations',
                        'Operations Analyst',
                        'Analytics Engineer',
                        'Business Operations Associate',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setTargetRole(chip)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                            targetRole === chip
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    How soon do you want to switch?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['< 1 month', '1 - 3 months', '3 - 6 months', '6 - 12 months'].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setTargetTimeline(time)}
                        className={`p-3 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                          targetTimeline === time
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: TELL US YOUR STORY ================= */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {!storyReviewMode ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Tell Us Your Story
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Speak freely, upload your current resume, or write your daily responsibilities. When you click Next, we strip verbal fillers and extract your transferable competencies automatically.
                    </p>
                  </div>

                  {/* Input Mode Selector */}
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setStoryInputMode('voice')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        storyInputMode === 'voice'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Mic size={14} className="shrink-0" />
                      <span>Voice Record</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoryInputMode('resume')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        storyInputMode === 'resume'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <UploadCloud size={14} className="shrink-0" />
                      <span>Upload Resume</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoryInputMode('type')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        storyInputMode === 'type'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <FileText size={14} className="shrink-0" />
                      <span>Type / Dictate</span>
                    </button>
                  </div>

                  {/* Voice Mode */}
                  {storyInputMode === 'voice' && (
                    <div className="p-5 rounded-2xl border-2 border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 text-center space-y-3">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={toggleRecording}
                          className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-md cursor-pointer ${
                            isRecording
                              ? 'bg-rose-600 hover:bg-rose-700 animate-pulse ring-4 ring-rose-200 dark:ring-rose-900'
                              : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-200 dark:ring-indigo-950'
                          }`}
                          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
                        >
                          {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {isRecording ? 'Listening... speak freely about your daily work' : 'Click microphone to start recording'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Mention your daily responsibilities, tools used, stakeholder meetings, and accomplishments.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resume Upload Mode */}
                  {storyInputMode === 'resume' && (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-3 transition-colors">
                      <UploadCloud className="w-9 h-9 mx-auto text-indigo-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {isUploading ? 'Parsing document text...' : 'Upload your resume (PDF, DOCX, TXT)'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Maximum file size 5 MB. Text will populate in the box below.
                        </p>
                      </div>

                      <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs">
                        <span>Browse File</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              try {
                                const parsed = await parseResumeFile(e.target.files[0]);
                                setNarrativeText(parsed);
                              } catch {
                                // Error tracked in hook
                              }
                            }
                          }}
                        />
                      </label>

                      {uploadError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                          {uploadError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Main Narrative Textarea (always visible so dictation works seamlessly) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Background Narrative & Responsibilities
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {narrativeText.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={narrativeText}
                      onChange={(e) => setNarrativeText(e.target.value)}
                      placeholder="e.g. In my role as a high school teacher, I developed differentiated lesson plans for 120+ students, analyzed quarterly performance metrics to adjust interventions, and aligned with parents..."
                      className="w-full p-4 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      💡 External speech-to-text and dictation software can dictate directly into this box.
                    </p>
                  </div>

                  {/* AI Extraction Loading State */}
                  {isExtracting && (
                    <AILoadingIndicator
                      title="AI Clean-up & Translation Engine Active"
                      stages={[
                        'Stripping verbal fillers and conversational hesitations...',
                        `Translating past duties into ${targetRole || 'target domain'} lexicon...`,
                        'Extracting transferable evidence, tools, and quantified metrics...',
                      ]}
                    />
                  )}
                </>
              ) : (
                /* REVIEW SCREEN AFTER EXTRACTION */
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="space-y-1 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 size={13} />
                      <span>Extracted & Translated Profile</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Review Your Extracted Competencies
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Everything has been structured into industry language. You can edit any item before continuing.
                    </p>
                  </div>

                  {/* Extracted Skills & Tools */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TagInput
                      label="Extracted Skills"
                      tags={skills}
                      onChange={setSkills}
                      placeholder="Add a skill..."
                    />
                    <TagInput
                      label="Extracted Tools"
                      tags={tools}
                      onChange={setTools}
                      placeholder="Add a tool (e.g. Excel, SQL)..."
                      badgeClassName="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    />
                  </div>

                  {/* Transferable Skills List */}
                  {extractedData?.transferableSkills && extractedData.transferableSkills.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Transferable Competencies Translated ({extractedData.transferableSkills.length})
                      </label>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {extractedData.transferableSkills.map((ts, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span className="text-slate-600 dark:text-slate-400 line-through decoration-slate-400">
                                {ts.originalSkill}
                              </span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                <span>→</span>
                                <span>{ts.translatedSkill}</span>
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              {ts.rationale}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setStoryReviewMode(false)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      ← Edit raw narrative or re-run speech
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 5: WHAT YOU ALREADY KNOW ================= */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  What You Already Know
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Confirm your existing toolkit. These competencies feed the known skills baseline so our gap analysis knows what you already bring to the table.
                </p>
              </div>

              <div className="space-y-5">
                <TagInput
                  label="Verified Skills & Methodologies"
                  tags={skills}
                  onChange={setSkills}
                  placeholder="e.g. Exploratory Data Analysis, Stakeholder Management..."
                />

                <TagInput
                  label="Software, Languages & Tools"
                  tags={tools}
                  onChange={setTools}
                  placeholder="e.g. Excel, SQL, Tableau, Python, Notion, Jira..."
                  badgeClassName="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 6: TARGET JOB POSTINGS ================= */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Target Job Postings
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Career Pivot Coach builds your empirical skill gap map by analyzing real job descriptions from your target market rather than generic assumptions.
                </p>
              </div>

              <JobPostingInput
                postings={postings}
                onChange={(updated) => {
                  setPostings(updated);
                  if (updated.length > 0) setSkippedPostings(false);
                }}
                minRecommended={3}
              />

              {/* Skip Option Notice */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSkippedPostings(true);
                    handleNext();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer underline"
                >
                  Skip for now
                </button>
                <span className="text-[11px] text-slate-400">
                  {postings.length >= 3 ? 'Ready to analyze market gaps' : 'Postings can also be added anytime later'}
                </span>
              </div>

              {skippedPostings && postings.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                  ⚠️ Note: Without job postings, your Skill Gap Map and custom Learning Plan will remain empty until you add descriptions on the dashboard.
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 7: COMMITMENT ================= */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Your Commitment & Pacing
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Configure your weekly bandwidth. We size the curriculum and prove-it milestones around your schedule.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hours Per Week */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600" />
                      <span>Hours Available / Week</span>
                    </label>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                      {hoursPerWeek}h
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHoursPerWeek(h)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          hoursPerWeek === h
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {h}h/wk
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Weeks */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-indigo-600" />
                      <span>Plan Duration</span>
                    </label>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                      {durationWeeks} wks
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[4, 6, 8, 12].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setDurationWeeks(w)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          durationWeeks === w
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {w} wks
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Work Mode & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Preferred Work Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['remote', 'hybrid', 'onsite'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWorkMode(mode)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize text-center border cursor-pointer transition-colors ${
                          workMode === mode
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Preferred Location / Market
                  </label>
                  <input
                    type="text"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    placeholder="e.g. Remote (US) or San Francisco, CA"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 8: REVIEW & LAUNCH ================= */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Review & Launch Your Transition Engine
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Everything is set. Review your details below. When you press &quot;Build my plan&quot;, we synthesize your custom curriculum and capstone projects.
                </p>
              </div>

              {/* Summary Cards with Edit Links */}
              <div className="space-y-3">
                {/* 1. Identity & Pathway */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Candidate & Pathway
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5">
                      {fullName || 'Candidate'}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                      <span>{currentRole || 'Previous Role'}</span>
                      <span>→</span>
                      <strong className="text-indigo-600 dark:text-indigo-400">{targetRole}</strong>
                      <span>({targetTimeline})</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>

                {/* 2. Skills & Tools Count */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Competency Toolkit
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5 font-medium">
                      <strong>{skills.length}</strong> Skills & <strong>{tools.length}</strong> Tools identified
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>

                {/* 3. Job Descriptions */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Market Analysis
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5 font-medium">
                      {postings.length > 0 ? (
                        <span><strong>{postings.length}</strong> real job descriptions provided</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Skipped (add postings later)</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(6)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>

                {/* 4. Commitment */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Pacing & Work Mode
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5 font-medium">
                      <strong>{hoursPerWeek} hrs/week</strong> for <strong>{durationWeeks} weeks</strong> • <span className="capitalize">{workMode}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(7)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Progress Screen when Building Plan */}
              {isBuildingPlan && (
                <AILoadingIndicator
                  title="Generating Your Career Pivot Engine"
                  stages={[
                    'Finalizing profile competencies and transferable rationales...',
                    postings.length > 0 ? 'Analyzing real job postings & calculating empirical skill gaps...' : 'Structuring core curriculum modules...',
                    `Calibrating custom ${durationWeeks}-week curriculum (${hoursPerWeek}h/week) & portfolio blueprints...`,
                  ]}
                />
              )}
            </div>
          )}

          {/* Wizard Footer Controls */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isBuildingPlan || isExtracting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isExtracting || isUploading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>
                  {currentStep === 4 && !storyReviewMode ? 'Extract & Review' : 'Next Step'}
                </span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuildPlanAndLaunch}
                disabled={isBuildingPlan}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>{isBuildingPlan ? 'Synthesizing Plan...' : 'Build My Plan & Launch'}</span>
              </button>
            )}
          </div>

        </div>
      </main>

      {/* Save & Continue Later Modal */}
      {saveLaterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Progress Saved</span>
              </h4>
              <button
                type="button"
                onClick={() => setSaveLaterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your setup answers have been synced to your account in Firestore. You can close this tab or sign out, and resume right at <strong>Step {currentStep}</strong> whenever you return.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSaveLaterModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Continue Setup Now
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSaveLaterModalOpen(false);
                  await signOut();
                  router.replace('/login');
                }}
                className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut size={13} />
                <span>Sign Out for Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
