'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Briefcase, 
  Target, 
  Award, 
  Plus, 
  Trash2, 
  Save, 
  Wrench, 
  Layers, 
  BookOpen,
  ArrowUpDown,
  Sliders,
  Check,
  UploadCloud
} from 'lucide-react';
import { getStoredState, saveStoredState } from '@/lib/storage';
import { TransferableSkill, UserProfile, SkillCategory } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import Link from 'next/link';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(() => getStoredState().profile);
  const [knownSkillsInput, setKnownSkillsInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCleaningOnly, setIsCleaningOnly] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cleanedIsStale, setCleanedIsStale] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    () => true
  );
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [savedSuccessBanner, setSavedSuccessBanner] = useState(false);

  // New tag inputs
  const [newSkillText, setNewSkillText] = useState('');
  const [newToolText, setNewToolText] = useState('');
  const [newAchievementText, setNewAchievementText] = useState('');

  // Web Speech recognition reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleStorage = () => {
      setProfile(getStoredState().profile);
    };
    window.addEventListener('career_pivot_storage_updated', handleStorage);

    // Initialize Web Speech API if supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript + ' ';
          }
        }
        if (finalChunk.trim()) {
          setProfile(prev => {
            if (!prev) return prev;
            const current = (prev.rawSpeech || '').trim();
            const addition = finalChunk.trim();
            return { ...prev, rawSpeech: current ? `${current} ${addition}` : addition };
          });
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      window.removeEventListener('career_pivot_storage_updated', handleStorage);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  const toggleRecording = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      setStatusMessage({ text: 'Speech recognition is not supported in this browser.', type: 'error' });
      return;
    }
    if (isRecording) {
      try {
        rec.stop();
      } catch (_) {}
      setIsRecording(false);
      setStatusMessage({ text: 'Recording paused. Ready to run cleanup and extract profile.', type: 'info' });
    } else {
      try {
        rec.start();
        setIsRecording(true);
        setStatusMessage({ text: 'Listening... speak naturally about your experience, past duties, and tools.', type: 'info' });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'InvalidStateError') {
          setIsRecording(true);
        } else {
          console.warn('Speech recognition notice:', err);
        }
      }
    }
  };

  // Run cleanup & extraction in one smooth flow
  const handleRunCleanupAndExtraction = async (overrideRawText?: string, fromResume = false) => {
    if (!profile) return;
    const useCleaned = !cleanedIsStale && Boolean(profile.cleanedSpeech?.trim());
    const inputNarrative = overrideRawText !== undefined 
      ? overrideRawText 
      : (useCleaned ? profile.cleanedSpeech.trim() : profile.rawSpeech?.trim());
    if (!inputNarrative) {
      setStatusMessage({ text: 'Please speak, paste your background narrative, or upload a resume first.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const res = await fetch('/api/ai/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanedSpeech: overrideRawText || !useCleaned ? undefined : profile.cleanedSpeech?.trim(),
          rawSpeech: overrideRawText || profile.rawSpeech?.trim() || undefined,
          speechText: inputNarrative,
          currentRole: fromResume ? undefined : profile.currentRole,
          targetRole: fromResume ? undefined : profile.targetRole,
          yearsExperience: fromResume ? undefined : profile.yearsExperience,
          knownSkills: fromResume ? undefined : knownSkillsInput
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.friendlyMessage || data.error || 'Failed to extract profile');

      const extractedSkills = Array.isArray(data.skills) ? data.skills : [];
      const extractedTools = Array.isArray(data.tools) ? data.tools : [];
      const combinedKnown = [...extractedSkills, ...extractedTools].filter(Boolean).join(', ');

      const rawTextToSave = overrideRawText !== undefined ? overrideRawText : (profile.rawSpeech || inputNarrative);
      const cleanedTextToSave = data.cleanedSpeech || profile.cleanedSpeech || rawTextToSave;

      // Leave Target Role for the user unless it's explicit in the resume
      const resolvedTargetRole = fromResume
        ? (data.targetRole && data.targetRole.trim() ? data.targetRole.trim() : (profile.targetRole || ''))
        : (data.targetRole || profile.targetRole);

      const updated: UserProfile = {
        ...profile,
        rawSpeech: rawTextToSave,
        cleanedSpeech: cleanedTextToSave,
        currentRole: data.currentRole || profile.currentRole || '',
        targetRole: resolvedTargetRole,
        yearsExperience: typeof data.yearsExperience === 'number' ? data.yearsExperience : (Number(data.yearsExperience) || profile.yearsExperience),
        skills: extractedSkills.length > 0 ? extractedSkills : (profile.skills || []),
        tools: extractedTools.length > 0 ? extractedTools : (profile.tools || []),
        responsibilities: Array.isArray(data.responsibilities) && data.responsibilities.length > 0 ? data.responsibilities : profile.responsibilities,
        achievements: Array.isArray(data.achievements) && data.achievements.length > 0 ? data.achievements : profile.achievements,
        transferableSkills: Array.isArray(data.transferableSkills) && data.transferableSkills.length > 0 ? data.transferableSkills : profile.transferableSkills,
        lastUpdated: new Date().toISOString()
      };

      if (fromResume && combinedKnown) {
        setKnownSkillsInput(combinedKnown);
      }

      setProfile(updated);
      setCleanedIsStale(false);

      // Auto-save initial extracted state
      const state = getStoredState();
      saveStoredState({ ...state, profile: updated });

      if (fromResume) {
        setStatusMessage({ 
          text: 'Resume uploaded - review and edit the details below.', 
          type: 'success' 
        });
      } else {
        setStatusMessage({ 
          text: 'Speech cleaned & tidy profile extracted! Review the side-by-side comparison and translated skills below.', 
          type: 'success' 
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract profile';
      if (fromResume) {
        setUploadError(`Failed to analyze resume details: ${msg}. You can edit the extracted text and try again.`);
      } else {
        setStatusMessage({ text: msg, type: 'error' });
      }
    } finally {
      setIsProcessing(false);
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);

    // Validate size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds the 5 MB limit. Please upload a smaller file.');
      return;
    }

    // Validate extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'txt'];
    if (!extension || !allowed.includes(extension)) {
      setUploadError(`Unsupported file format (.${extension || 'unknown'}). Please upload a PDF, DOCX, or TXT file.`);
      return;
    }

    // Check if user has already edited fields
    const hasExistingContent = Boolean(
      (profile?.rawSpeech && profile.rawSpeech.trim()) ||
      (profile?.currentRole && profile.currentRole.trim()) ||
      (profile?.yearsExperience && profile.yearsExperience > 0) ||
      (profile?.skills && profile.skills.length > 0) ||
      (profile?.tools && profile.tools.length > 0) ||
      (profile?.achievements && profile.achievements.length > 0) ||
      knownSkillsInput.trim()
    );

    if (hasExistingContent) {
      const confirmOverwrite = window.confirm(
        'You have existing profile information. Overwriting will replace your current edits with details from this resume. Do you want to proceed?'
      );
      if (!confirmOverwrite) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const parseRes = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok) {
        throw new Error(parseData.error || 'Failed to parse resume file.');
      }

      const extractedText = parseData.text;
      if (!extractedText || !extractedText.trim()) {
        throw new Error('No readable text could be extracted from this file. If this is a scanned document, please convert it with OCR or paste the text directly.');
      }

      // Populate rawSpeech in textarea
      setProfile(prev => ({
        ...prev,
        rawSpeech: extractedText
      }));

      // Run existing cleaning + extraction pipeline on it
      await handleRunCleanupAndExtraction(extractedText, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process resume';
      setUploadError(msg);
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  // Re-clean just the speech narrative
  const handleCleanSpeechOnly = async () => {
    if (!profile?.rawSpeech.trim()) {
      setStatusMessage({ text: 'Please enter or record some spoken narrative first.', type: 'error' });
      return;
    }

    setIsCleaningOnly(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/ai/clean-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawSpeech: profile.rawSpeech })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clean speech');

      const updated = {
        ...profile,
        cleanedSpeech: data.cleanText || data.cleanedSpeech,
        lastUpdated: new Date().toISOString()
      };
      setProfile(updated);
      setCleanedIsStale(false);

      const state = getStoredState();
      saveStoredState({ ...state, profile: updated });

      const scCount = data.details?.selfCorrectionsResolved?.length || 0;
      const fillerCount = data.details?.fillersRemoved?.length || 0;
      setStatusMessage({ 
        text: `Speech cleaned! Removed ${fillerCount} fillers and resolved ${scCount} self-corrections.`, 
        type: 'success' 
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clean speech';
      setStatusMessage({ text: msg, type: 'error' });
    } finally {
      setIsCleaningOnly(false);
    }
  };

  // Save all edits to localStorage
  const handleSaveAll = () => {
    if (!profile) return;
    const updated = {
      ...profile,
      lastUpdated: new Date().toISOString()
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
    setSavedSuccessBanner(true);
    setStatusMessage({ text: 'All profile changes, skills, and translations saved successfully!', type: 'success' });
    setTimeout(() => setSavedSuccessBanner(false), 4000);
  };

  // Add / remove tags
  const addSkill = () => {
    if (!newSkillText.trim() || !profile) return;
    const current = profile.skills || [];
    if (!current.includes(newSkillText.trim())) {
      setProfile({ ...profile, skills: [...current, newSkillText.trim()] });
    }
    setNewSkillText('');
  };

  const removeSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter(s => s !== skillToRemove)
    });
  };

  const addTool = () => {
    if (!newToolText.trim() || !profile) return;
    const current = profile.tools || [];
    if (!current.includes(newToolText.trim())) {
      setProfile({ ...profile, tools: [...current, newToolText.trim()] });
    }
    setNewToolText('');
  };

  const removeTool = (toolToRemove: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      tools: (profile.tools || []).filter(t => t !== toolToRemove)
    });
  };

  const addAchievement = () => {
    if (!newAchievementText.trim() || !profile) return;
    setProfile({
      ...profile,
      achievements: [...profile.achievements, newAchievementText.trim()]
    });
    setNewAchievementText('');
  };

  const removeAchievement = (index: number) => {
    if (!profile) return;
    setProfile({
      ...profile,
      achievements: profile.achievements.filter((_, i) => i !== index)
    });
  };

  // Transferable skills editor
  const updateTransferableSkill = (id: string, updates: Partial<TransferableSkill>) => {
    if (!profile) return;
    setProfile({
      ...profile,
      transferableSkills: profile.transferableSkills.map(skill => 
        skill.id === id ? { ...skill, ...updates } : skill
      )
    });
  };

  const removeTransferableSkill = (id: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      transferableSkills: profile.transferableSkills.filter(s => s.id !== id)
    });
  };

  const addCustomTransferableSkill = () => {
    if (!profile) return;
    const newSkill: TransferableSkill = {
      id: `ts-custom-${Date.now()}`,
      originalSkill: 'Running scheduling system and coordination',
      translatedSkill: 'Scheduling Logic & Structured Data Modeling',
      category: 'Technical',
      rationale: 'Demonstrates constraint management, relational data handling, and workflow optimization required in the new role.',
      strengthLevel: 'Intermediate'
    };
    setProfile({
      ...profile,
      transferableSkills: [...profile.transferableSkills, newSkill]
    });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <RefreshCw className="animate-spin text-indigo-600" size={16} />
          <span>Loading candidate profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2">
              <Sparkles size={14} className="shrink-0" />
              <span>Step 1: Background & Skills Translator</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Candidate Background & Intake Engine
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Talk freely about what you did in your past career, paste your resume, or upload a resume document. We clean messy verbal speech, extract your tidy profile, and translate old duties into skills that matter in your target field.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSaveAll}
              type="button"
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Save size={14} className="shrink-0" />
              <span>Save Profile</span>
            </button>
          </div>
        </div>

        {/* Resume Upload Control (Button + Drag-and-Drop) */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragging 
              ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-4 ring-indigo-500/10' 
              : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/20'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
          />

          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isDragging ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
            }`}>
              {isUploading ? <RefreshCw size={20} className="animate-spin" /> : <UploadCloud size={20} />}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isUploading ? 'Extracting & analyzing resume...' : 'Upload your resume to prefill your profile'}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  Upload
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Drag and drop your file here, or click to browse. Supports PDF, DOCX, and TXT (up to 5 MB).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isUploading ? 'Processing...' : 'Choose Resume File'}
            </button>
          </div>
        </div>

        {/* Inline Upload Error */}
        {uploadError && (
          <div className="mt-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span className="font-medium">{uploadError}</span>
          </div>
        )}

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
              <span>Saved! All changes are synced to your browser workspace.</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Processing Loading State */}
      {(isProcessing || isCleaningOnly || isUploading) && (
        <AILoadingIndicator
          title={isCleaningOnly ? "AI Speech Cleaner Active" : (isUploading ? "AI Resume Intake & Skills Translator Active" : "AI Profile Extraction & Skills Translator Active")}
          stages={[
            "Reading background narrative & extracting text layers...",
            "Removing verbal filler words ('um', 'you know', 'basically') & resolving false starts...",
            "Extracting core competencies, software tools, and quantified achievements...",
            `Translating your past experience into the currency of ${profile.targetRole || 'your target field'}...`
          ]}
        />
      )}

      {/* SECTION 1: Intake Information (Target Role, Current Background, What You Already Know, Voice / Resume Intake) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>1. Transition Goals & What You Already Know</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Specify the role you want, your previous title, and any skills or tools you already know.
            </p>
          </div>
        </div>

        {/* 3-Column Inputs: Target Role, Current Role, Years of Experience */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              The Role You Want (Target Role)
            </label>
            <div className="relative">
              <input
                type="text"
                value={profile.targetRole}
                onChange={(e) => setProfile({ ...profile, targetRole: e.target.value })}
                placeholder="e.g. Junior Data Analyst, Product Manager"
                className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-sm font-semibold text-indigo-900 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              The exact job title you are targeting in this pivot.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Current / Past Role
            </label>
            <input
              type="text"
              value={profile.currentRole}
              onChange={(e) => setProfile({ ...profile, currentRole: e.target.value })}
              placeholder="e.g. High School Math Teacher, Accountant"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Your previous industry or primary professional identity.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Years of Experience
            </label>
            <input
              type="number"
              min={0}
              max={40}
              value={profile.yearsExperience || 0}
              onChange={(e) => setProfile({ ...profile, yearsExperience: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Total cumulative professional experience.
            </p>
          </div>
        </div>

        {/* Big Text Box: What they already know */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            What You Already Know (Existing Skills, Self-Study, Tools, or Certificates)
          </label>
          <textarea
            rows={3}
            value={knownSkillsInput}
            onChange={(e) => setKnownSkillsInput(e.target.value)}
            placeholder="Tell us what you already know: e.g. 'I know basic Python, Excel formulas, high school algebra, statistical testing, and I completed a SQL beginner course...'"
            className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/40 dark:bg-slate-800/30 leading-relaxed"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Our AI takes this into account to prevent generic recommendations and build your exact skill gap map.
          </p>
        </div>

        {/* Big Narrative Text Box with Voice Key & Resume Intake */}
        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Spoken Background or Pasted Resume
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Talk casually about your daily tasks, projects, numbers, or paste your existing resume.
              </p>
            </div>

            {/* Voice Key Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleRecording}
                disabled={!speechSupported}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse shadow-rose-200 dark:shadow-rose-900/40'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-indigo-950/40'
                }`}
              >
                {isRecording ? <MicOff size={16} className="shrink-0" /> : <Mic size={16} className="shrink-0" />}
                <span>{isRecording ? 'Stop Voice Recording' : 'Voice Key: Press to Talk'}</span>
              </button>
            </div>
          </div>

          {/* Prompt Required Hint Callout */}
          <div className="mb-3 p-3 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 text-xs font-medium">
              <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Hint: Press your voice key and just talk.</span>
            </div>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 hidden sm:inline">
              Speak naturally without worrying about fillers like &ldquo;um&rdquo; or &ldquo;like&rdquo;.
            </span>
          </div>

          <textarea
            rows={7}
            value={profile.rawSpeech}
            onChange={(e) => setProfile({ ...profile, rawSpeech: e.target.value })}
            placeholder="Talk about what you did: 'So um, basically in my last job I was responsible for managing student grade data in Excel spreadsheets, resolving scheduling conflicts, and presenting quarterly performance to administrators...'"
            className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 font-mono text-xs leading-relaxed"
          />

          {/* Action Row */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {profile.rawSpeech ? `${profile.rawSpeech.split(/\s+/).filter(Boolean).length} words recorded` : 'Awaiting speech or resume input'}
            </span>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCleanSpeechOnly}
                disabled={isCleaningOnly || isProcessing || !profile.rawSpeech?.trim()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isCleaningOnly ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Sparkles size={14} className="shrink-0" />}
                <span>{isCleaningOnly ? 'Cleaning...' : 'Clean Speech Only'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunCleanupAndExtraction()}
                disabled={isProcessing || (!profile.rawSpeech?.trim() && !profile.cleanedSpeech?.trim())}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm shadow-indigo-200 dark:shadow-indigo-950"
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Layers size={14} className="shrink-0" />}
                <span>{isProcessing ? 'Cleaning & Extracting Tidy Profile...' : 'Run Cleanup & Extract Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Side-by-Side Raw vs. Clean Version (Editable before saving) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowUpDown size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>2. Raw vs. Clean Narrative Comparison</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect the raw spoken input and the AI-cleaned version side by side. You can edit either column before saving.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-lg">
            Side-by-Side Review
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Left Column: Raw Version */}
          <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Mic size={14} className="text-slate-400 shrink-0" />
                  <span>Raw Spoken / Pasted Version</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {profile.rawSpeech ? `${profile.rawSpeech.split(/\s+/).filter(Boolean).length} words` : 'Empty'}
                </span>
              </div>
              <textarea
                rows={9}
                value={profile.rawSpeech}
                onChange={(e) => setProfile({ ...profile, rawSpeech: e.target.value })}
                placeholder="Raw spoken audio with fillers ('um', 'you know', 'like') will appear here..."
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Editable. May include hesitations, verbal fillers, or conversational tangents.
            </p>
          </div>

          {/* Right Column: Clean Version */}
          <div className="flex flex-col justify-between p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Cleaned & Polished Version</span>
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {profile.cleanedSpeech ? `${profile.cleanedSpeech.split(/\s+/).filter(Boolean).length} words (Polished)` : 'Awaiting cleanup'}
                </span>
              </div>
              <textarea
                rows={9}
                value={profile.cleanedSpeech}
                onChange={(e) => setProfile({ ...profile, cleanedSpeech: e.target.value })}
                placeholder="Cleaned, concise, professional English narrative without verbal fillers or false starts..."
                className="w-full p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2">
              Editable. Verbal crutches stripped and self-corrections resolved into clean professional phrasing.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Tidy Profile Extraction (Current Role, Years Experience, Skills, Tools, Achievements, Target Role) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>3. Extracted Tidy Profile</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Structured summary of role, experience, demonstrated skills, tools, and quantifiable achievements.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          >
            <Save size={13} className="shrink-0" />
            <span>Save Tidy Profile</span>
          </button>
        </div>

        {/* Top metrics badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Role</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {profile.currentRole || 'Not specified'}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Years of Experience</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {profile.yearsExperience || 0} Years
            </div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Target Pivot Role</span>
            <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mt-1">
              {profile.targetRole || 'Not specified'}
            </div>
          </div>
        </div>

        {/* Skills & Tools Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Skills Pill Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Extracted Demonstrated Skills ({(profile.skills || []).length})</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3 min-h-[48px]">
              {(profile.skills || []).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 size={12} className="shrink-0" />
                  </button>
                </span>
              ))}
              {(!profile.skills || profile.skills.length === 0) && (
                <span className="text-xs text-slate-400 italic">No skills extracted yet. Run cleanup to generate.</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add custom skill..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                Add Skill
              </button>
            </div>
          </div>

          {/* Tools & Software Pill Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wrench size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Tools & Software Used ({(profile.tools || []).length})</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3 min-h-[48px]">
              {(profile.tools || []).map((tool, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200/80 dark:border-indigo-800"
                >
                  <span>{tool}</span>
                  <button
                    type="button"
                    onClick={() => removeTool(tool)}
                    className="text-indigo-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 size={12} className="shrink-0" />
                  </button>
                </span>
              ))}
              {(!profile.tools || profile.tools.length === 0) && (
                <span className="text-xs text-slate-400 italic">No tools extracted yet. Run cleanup to generate.</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                value={newToolText}
                onChange={(e) => setNewToolText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                placeholder="Add tool (e.g. Tableau, Excel, SQL)..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addTool}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                Add Tool
              </button>
            </div>
          </div>
        </div>

        {/* Quantifiable Achievements */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award size={14} className="text-amber-500 shrink-0" />
              <span>Quantifiable Accomplishments & Wins ({profile.achievements.length})</span>
            </span>
          </div>

          <div className="space-y-2">
            {profile.achievements.map((ach, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {ach}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAchievement(idx)}
                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer shrink-0"
                  title="Remove achievement"
                >
                  <Trash2 size={13} className="shrink-0" />
                </button>
              </div>
            ))}

            {profile.achievements.length === 0 && (
              <p className="text-xs text-slate-400 italic">No achievements extracted yet. Run cleanup to generate.</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={newAchievementText}
              onChange={(e) => setNewAchievementText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
              placeholder="Add quantifiable win (e.g. 'Boosted student pass rates by 18% using custom Excel tracker')..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addAchievement}
              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              Add Achievement
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: Skills Translator (Mapping old experience to skills that matter in target role) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-1">
              <Sliders size={13} className="shrink-0" />
              <span>Domain Translation Engine</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Skills Translator: Old Experience → Target Role Currency
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              We map portions of your old experience directly to skills hiring managers look for.
              For example, <span className="font-semibold text-slate-700 dark:text-slate-300">running a school timetable system</span> becomes <span className="font-semibold text-indigo-600 dark:text-indigo-400">scheduling logic and working with structured data</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addCustomTransferableSkill}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Plus size={14} className="shrink-0" />
              <span>Add Custom Translation</span>
            </button>
          </div>
        </div>

        {/* Translation Cards List */}
        <div className="space-y-4">
          {profile.transferableSkills.map((skill) => (
            <div 
              key={skill.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors bg-white dark:bg-slate-900/80 shadow-xs space-y-4"
            >
              {/* Category, Strength Level & Delete */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={skill.category}
                    onChange={(e) => updateTransferableSkill(skill.id, { category: e.target.value as SkillCategory })}
                    className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Domain">Domain</option>
                    <option value="Soft Skill">Soft Skill</option>
                    <option value="Tool">Tool</option>
                  </select>

                  <select
                    value={skill.strengthLevel}
                    onChange={(e) => updateTransferableSkill(skill.id, { strengthLevel: e.target.value as 'Foundational' | 'Intermediate' | 'Advanced' })}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border focus:outline-none ${
                      skill.strengthLevel === 'Advanced'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : skill.strengthLevel === 'Intermediate'
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <option value="Foundational">Foundational</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => removeTransferableSkill(skill.id)}
                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer transition-colors"
                  title="Remove translated skill"
                >
                  <Trash2 size={14} className="shrink-0" />
                </button>
              </div>

              {/* 3-Section Grid: Original Thing They Did -> Translated Skill -> Why It Counts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Original thing they did */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    1. Original Thing You Did
                  </span>
                  <textarea
                    rows={3}
                    value={skill.originalSkill}
                    onChange={(e) => updateTransferableSkill(skill.id, { originalSkill: e.target.value })}
                    placeholder="What you did in your past role..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 2. Translated skills */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <ArrowRight size={12} className="shrink-0" />
                    <span>2. Translated Skill (Target Currency)</span>
                  </span>
                  <textarea
                    rows={3}
                    value={skill.translatedSkill}
                    onChange={(e) => updateTransferableSkill(skill.id, { translatedSkill: e.target.value })}
                    placeholder="How hiring managers describe this competency..."
                    className="w-full p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/20 text-xs font-semibold text-indigo-900 dark:text-indigo-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 3. Why it counts */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    3. Why It Counts (Hiring Rationale)
                  </span>
                  <textarea
                    rows={3}
                    value={skill.rationale}
                    onChange={(e) => updateTransferableSkill(skill.id, { rationale: e.target.value })}
                    placeholder="Why this matters in the new field..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}

          {profile.transferableSkills.length === 0 && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No translated skills yet. Enter your background narrative above and click &ldquo;Run Cleanup & Extract Profile&rdquo; to translate your experience into {profile.targetRole || 'your target role'} skills.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: Save All & Bottom Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Ready to Save Your Profile & Translations?</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Saving updates your browser workspace and powers your Skill Gap Map, Learning Plan, and Mock Interviews.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Save size={15} className="shrink-0" />
            <span>Save Changes</span>
          </button>

          <Link
            href="/skill-gaps"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-100 dark:shadow-indigo-950 shrink-0"
          >
            <span>Proceed to Step 2: Skill Gap Map</span>
            <ArrowRight size={15} className="shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
