'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppState, saveStoredState } from '@/lib/storage';
import { useResumeUpload } from '@/hooks/useResumeUpload';
import { useProfileExtraction, ExtractedProfileResult } from '@/hooks/useProfileExtraction';
import TagInput from '@/components/TagInput';
import JobPostingInput from '@/components/JobPostingInput';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import { apiFetch } from '@/lib/apiClient';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  Clock,
  CalendarDays,
  Edit3,
  LogOut,
  X,
  RefreshCw
} from 'lucide-react';
import { AppState, JobPosting } from '@/types';

const TOTAL_STEPS = 8;

const STEP_TITLES = [
  'Welcome',
  'Your Current Background',
  'Where You Want to Go',
  'Upload Your Resume',
  'What You Already Know',
  'Target Job Postings',
  'Your Commitment',
  'Review & Finish',
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
  const [industry, setIndustry] = useState(() => state?.profile?.industry || '');
  const [yearsExperience, setYearsExperience] = useState<string>(() => {
    const yr = state?.profile?.yearsExperience;
    if (yr !== undefined && yr !== null && yr !== 0) {
      return String(yr);
    }
    return '';
  });

  const handleYearsChange = (val: string) => {
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setYearsExperience(val);
    }
  };

  const parsedYears = parseFloat(yearsExperience);
  const isYearsAbove50 = !isNaN(parsedYears) && parsedYears > 50;
  const isYearsEmpty = yearsExperience.trim() === '';
  const isYearsValid = !isYearsEmpty && !isNaN(parsedYears) && parsedYears >= 0 && parsedYears <= 50;

  const isStep2Valid =
    currentRole.trim().length > 0 &&
    industry.trim().length > 0 &&
    isYearsValid;

  // Step 3: Target Role & Timeline
  const [targetRole, setTargetRole] = useState(() => state?.profile?.targetRole || '');
  const [targetTimeline, setTargetTimeline] = useState(() => state?.profile?.preferences?.targetTimeline || '3 - 6 months');

  const isStep3Valid =
    targetRole.trim().length > 0 &&
    targetTimeline.trim().length > 0;

  // Step 4: Resume or Manual Form
  const [resumeFileName, setResumeFileName] = useState<string | null>(() => {
    if (state?.profile?.resumeFileName) return state.profile.resumeFileName;
    if (state?.profile?.rawSpeech && (!state.profile.responsibilities || state.profile.responsibilities.length === 0)) {
      return 'resume_document.pdf';
    }
    return null;
  });

  const [storyInputMode, setStoryInputMode] = useState<'resume' | 'form'>(() => {
    if (state?.profile?.responsibilities && state.profile.responsibilities.length > 0 && !state?.profile?.resumeFileName) {
      return 'form';
    }
    return 'resume';
  });

  const [dayToDay, setDayToDay] = useState<string[]>(() => {
    if (state?.profile?.responsibilities && state.profile.responsibilities.length > 0) {
      return state.profile.responsibilities;
    }
    return ['', '', ''];
  });

  const [achievementsList, setAchievementsList] = useState<string[]>(() => {
    if (state?.profile?.achievements && state.profile.achievements.length > 0) {
      return state.profile.achievements;
    }
    return ['', ''];
  });

  const [narrativeText, setNarrativeText] = useState(() => state?.profile?.rawSpeech || state?.profile?.cleanedSpeech || '');
  const [storyReviewMode, setStoryReviewMode] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedProfileResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Hooks for Resume Upload and Extraction
  const { isUploading, uploadError, setUploadError, parseResumeFile } = useResumeUpload();
  const { isExtracting, extractProfile } = useProfileExtraction();

  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    setStepError(null);
    try {
      const parsed = await parseResumeFile(file);
      setResumeFileName(file.name);
      setNarrativeText(parsed);
      // Resume wins: clear form entries
      setDayToDay(['', '', '']);
      setAchievementsList(['', '']);
      setStoryInputMode('resume');
    } catch {
      // Friendly error is set in useResumeUpload
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveResume = () => {
    setResumeFileName(null);
    setNarrativeText('');
    setUploadError(null);
  };

  const isStep4Ready = storyInputMode === 'resume'
    ? (!!resumeFileName && !!narrativeText.trim() && !isUploading)
    : (dayToDay.map(s => s.trim()).filter(Boolean).length >= 2);

  // Synchronize and persist state after each step
  const persistCurrentProgress = (nextStepNumber?: number) => {
    const cleanedDayToDay = dayToDay.map(s => s.trim()).filter(Boolean);
    const cleanedAchievements = achievementsList.map(s => s.trim()).filter(Boolean);
    const parsed = parseFloat(yearsExperience);
    const finalYears = !isNaN(parsed) ? parsed : yearsExperience;

    const updatedState: AppState = {
      ...state,
      profile: {
        ...state.profile,
        fullName: fullName.trim(),
        currentRole: currentRole.trim(),
        industry: industry.trim(),
        targetRole: targetRole.trim(),
        yearsExperience: finalYears,
        rawSpeech: narrativeText.trim(),
        skills,
        tools,
        responsibilities: storyInputMode === 'form' ? cleanedDayToDay : [],
        achievements: storyInputMode === 'form' ? cleanedAchievements : (state.profile.achievements || []),
        resumeFileName: storyInputMode === 'resume' ? (resumeFileName || '') : '',
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
          setStepError('Please enter your full name.');
          return false;
        }
        return true;
      case 2:
        if (!currentRole.trim()) {
          setStepError('Please enter your current or most recent role.');
          return false;
        }
        if (!industry.trim()) {
          setStepError('Please enter your industry.');
          return false;
        }
        if (isYearsEmpty) {
          setStepError('Please enter your years of experience.');
          return false;
        }
        if (!isYearsValid) {
          setStepError('Please enter a value between 0 and 50 years.');
          return false;
        }
        return true;
      case 3:
        if (!targetRole.trim()) {
          setStepError('Please enter your target role.');
          return false;
        }
        if (!targetTimeline.trim()) {
          setStepError('Please select a target timeline.');
          return false;
        }
        return true;
      case 4:
        if (storyInputMode === 'resume') {
          if (!resumeFileName || !narrativeText.trim()) {
            setStepError('Please upload your resume to continue.');
            return false;
          }
        } else {
          const filled = dayToDay.map(s => s.trim()).filter(Boolean);
          if (filled.length < 2) {
            setStepError('Please enter at least two day-to-day responsibilities.');
            return false;
          }
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

    let textForExtraction = narrativeText.trim();

    if (storyInputMode === 'form') {
      const filledDayToDay = dayToDay.map(s => s.trim()).filter(Boolean);
      const filledAch = achievementsList.map(s => s.trim()).filter(Boolean);

      const parts: string[] = [];
      if (currentRole.trim()) {
        parts.push(`Current role: ${currentRole.trim()}${yearsExperience ? ` (${yearsExperience} years of experience)` : ''}`);
      }
      parts.push(`Daily responsibilities:\n${filledDayToDay.map(line => `- ${line}`).join('\n')}`);
      if (filledAch.length > 0) {
        parts.push(`Key achievements:\n${filledAch.map(a => `- ${a}`).join('\n')}`);
      }

      textForExtraction = parts.join('\n\n');
      setNarrativeText(textForExtraction);
    }

    try {
      const parsed = parseFloat(yearsExperience);
      const numYears = !isNaN(parsed) ? parsed : undefined;

      const data = await extractProfile({
        narrativeText: textForExtraction,
        currentRole,
        targetRole,
        yearsExperience: numYears,
        knownSkills: [...skills, ...tools].join(', '),
      });

      setExtractedData(data);

      if (data.skills && data.skills.length > 0) {
        setSkills((prev) => Array.from(new Set([...prev, ...(data.skills || [])])));
      }
      if (data.tools && data.tools.length > 0) {
        setTools((prev) => Array.from(new Set([...prev, ...(data.tools || [])])));
      }

      setStoryReviewMode(true);
    } catch {
      setStepError('Something went wrong. Please try again.');
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

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
      const cleanedDayToDay = dayToDay.map(s => s.trim()).filter(Boolean);
      const cleanedAchievements = achievementsList.map(s => s.trim()).filter(Boolean);
      const parsed = parseFloat(yearsExperience);
      const finalYears = !isNaN(parsed) ? parsed : yearsExperience;

      currentState.profile = {
        ...currentState.profile,
        fullName: fullName.trim(),
        currentRole: currentRole.trim(),
        industry: industry.trim(),
        targetRole: targetRole.trim(),
        yearsExperience: finalYears,
        rawSpeech: narrativeText.trim(),
        skills,
        tools,
        responsibilities: storyInputMode === 'form' ? cleanedDayToDay : (currentState.profile.responsibilities || []),
        achievements: storyInputMode === 'form' ? cleanedAchievements : (currentState.profile.achievements || []),
        resumeFileName: storyInputMode === 'resume' ? (resumeFileName || '') : '',
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
          const mapRes = await apiFetch('/api/ai/map-skill-gaps', {
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
        } catch {
          // Continue gracefully
        }
      }

      // 3. Generate Learning Plan
      try {
        const planRes = await apiFetch('/api/ai/generate-learning-plan', {
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
      } catch {
        // Continue gracefully
      }

      currentState.onboarding = {
        completed: true,
        currentStep: TOTAL_STEPS,
        completedAt: new Date().toISOString(),
      };

      saveStoredState(currentState);
      setState(currentState);

      router.replace('/');
    } catch {
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
                Step {currentStep} of {TOTAL_STEPS}
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
              Save and continue later
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
          
          {/* Step Indicator */}
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
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Let&apos;s set up your profile and target goals.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder=""
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2: CURRENT BACKGROUND ================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Your Current Background
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Tell us about your most recent role and experience.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Current or Most Recent Role
                  </label>
                  <input
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder=""
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder=""
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Years of Experience
                  </label>
                  <div className="flex items-center gap-2 max-w-[220px]">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={yearsExperience}
                        onChange={(e) => handleYearsChange(e.target.value)}
                        placeholder=""
                        className={`w-full px-4 py-3 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 font-medium ${
                          isYearsAbove50
                            ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 select-none">
                      years
                    </span>
                  </div>

                  {isYearsAbove50 && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1.5">
                      Please enter a value of 50 years or less.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: WHERE YOU WANT TO GO ================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Where You Want to Go
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Choose your target role and timeline.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Role
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder=""
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Target Timeline
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

          {/* ================= STEP 4: UPLOAD YOUR RESUME (OR FORM) ================= */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {!storyReviewMode ? (
                <>
                  {storyInputMode === 'resume' ? (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          Upload your resume
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Add your resume in PDF, DOCX or TXT format.
                        </p>
                      </div>

                      {/* Resume Upload Area */}
                      {isUploading ? (
                        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-3 text-center">
                          <RefreshCw size={24} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Reading your resume...
                          </p>
                        </div>
                      ) : (resumeFileName && narrativeText.trim()) ? (
                        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {resumeFileName}
                              </p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                Resume uploaded successfully
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shadow-2xs"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveResume}
                              className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={handleFileDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-3 cursor-pointer transition-colors"
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                          <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <UploadCloud size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Upload your resume
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Click or drag and drop a PDF, DOCX or TXT file (up to 5 MB)
                            </p>
                          </div>
                          <span className="inline-block px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs">
                            Choose File
                          </span>
                        </div>
                      )}

                      {/* Friendly Error */}
                      {uploadError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
                          {uploadError}
                        </div>
                      )}

                      {/* Small text link: "I don't have a resume" */}
                      <div className="pt-2 text-center sm:text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setUploadError(null);
                            setStepError(null);
                            setStoryInputMode('form');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                        >
                          I don&apos;t have a resume
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* FORM MODE */
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          Your experience
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          List what you did day to day and any key achievements.
                        </p>
                      </div>

                      {/* Day-to-Day Responsibilities */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            What you did day to day <span className="text-slate-400 font-normal">(at least 2 lines)</span>
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {dayToDay.filter(l => l.trim().length > 0).length} of 2 required
                          </span>
                        </div>

                        <div className="space-y-2">
                          {dayToDay.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const updated = [...dayToDay];
                                  updated[idx] = e.target.value;
                                  setDayToDay(updated);
                                }}
                                placeholder=""
                                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                              {dayToDay.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = dayToDay.filter((_, i) => i !== idx);
                                    setDayToDay(updated.length > 0 ? updated : ['']);
                                  }}
                                  className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Remove line"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setDayToDay([...dayToDay, ''])}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer pt-1"
                        >
                          <Plus size={14} />
                          <span>Add another</span>
                        </button>
                      </div>

                      {/* Achievements */}
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Key achievements <span className="text-slate-400 font-normal">(optional, with numbers if you have them)</span>
                          </label>
                        </div>

                        <div className="space-y-2">
                          {achievementsList.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const updated = [...achievementsList];
                                  updated[idx] = e.target.value;
                                  setAchievementsList(updated);
                                }}
                                placeholder=""
                                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                              {achievementsList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = achievementsList.filter((_, i) => i !== idx);
                                    setAchievementsList(updated.length > 0 ? updated : ['']);
                                  }}
                                  className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Remove line"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setAchievementsList([...achievementsList, ''])}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer pt-1"
                        >
                          <Plus size={14} />
                          <span>Add another</span>
                        </button>
                      </div>

                      {/* Small text link: "Upload a resume instead" */}
                      <div className="pt-2 text-center sm:text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setUploadError(null);
                            setStepError(null);
                            setStoryInputMode('resume');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                        >
                          Upload a resume instead
                        </button>
                      </div>
                    </div>
                  )}

                  {isExtracting && (
                    <AILoadingIndicator />
                  )}
                </>
              ) : (
                /* REVIEW SCREEN AFTER EXTRACTION (Read-only translated skills with small rationale) */
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Review Extracted Details
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Review your extracted skills and translated competencies.
                    </p>
                  </div>

                  {/* Extracted Skills & Tools */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TagInput
                      label="Skills"
                      tags={skills}
                      onChange={setSkills}
                      placeholder="Add a skill..."
                    />
                    <TagInput
                      label="Tools & Software"
                      tags={tools}
                      onChange={setTools}
                      placeholder="Add a tool..."
                      badgeClassName="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    />
                  </div>

                  {/* Read-Only Translated Skills List */}
                  {extractedData?.transferableSkills && extractedData.transferableSkills.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Translated Skills ({extractedData.transferableSkills.length})
                      </label>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {extractedData.transferableSkills.map((ts, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs space-y-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400">
                                {ts.originalSkill}
                              </span>
                              <ArrowRight size={12} className="text-slate-400 shrink-0" />
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                {ts.translatedSkill}
                              </span>
                            </div>
                            {ts.rationale && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                {ts.rationale}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setStoryReviewMode(false)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      ← Edit text or re-upload resume
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 5: WHAT YOU ALREADY KNOW ================= */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  What You Already Know
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Confirm the skills and tools you already have.
                </p>
              </div>

              <div className="space-y-5">
                <TagInput
                  label="Skills"
                  tags={skills}
                  onChange={setSkills}
                  placeholder=""
                />

                <TagInput
                  label="Tools & Software"
                  tags={tools}
                  onChange={setTools}
                  placeholder=""
                  badgeClassName="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 6: TARGET JOB POSTINGS ================= */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Target Job Postings
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Add target job postings to compare your skills against real role requirements.
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

              {/* Skip Option */}
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
                  {postings.length >= 3 ? 'Ready' : 'You can add postings later'}
                </span>
              </div>

              {skippedPostings && postings.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                  Note: You can add job postings later from the Skill Gaps page.
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 7: COMMITMENT ================= */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Your Commitment
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Set your weekly availability and preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hours Per Week */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600" />
                      <span>Hours Available / Week</span>
                    </label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
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
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-indigo-600" />
                      <span>Plan Duration</span>
                    </label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Work Mode
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
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Preferred Location
                  </label>
                  <input
                    type="text"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 8: REVIEW & LAUNCH ================= */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Review & Finish
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Review your information before completing setup.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Profile & Target
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">
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

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Skills & Tools
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5 font-medium">
                      <strong>{skills.length}</strong> Skills & <strong>{tools.length}</strong> Tools
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

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Job Postings
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5 font-medium">
                      {postings.length > 0 ? (
                        <span><strong>{postings.length}</strong> postings added</span>
                      ) : (
                        <span className="text-slate-500">Skipped (add later)</span>
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

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Commitment
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

              {isBuildingPlan && (
                <AILoadingIndicator />
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
                disabled={
                  isExtracting || 
                  isUploading || 
                  (currentStep === 1 && !fullName.trim()) ||
                  (currentStep === 2 && !isStep2Valid) ||
                  (currentStep === 3 && !isStep3Valid) ||
                  (currentStep === 4 && !storyReviewMode && !isStep4Ready)
                }
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>
                  {currentStep === 4 && !storyReviewMode && isExtracting ? 'Working on it...' : 'Next'}
                </span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuildPlanAndLaunch}
                disabled={isBuildingPlan}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{isBuildingPlan ? 'Working on it...' : 'Finish Setup'}</span>
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your setup answers have been saved. You can close this tab and resume at <strong>Step {currentStep}</strong> whenever you return.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSaveLaterModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Continue Setup
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
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
