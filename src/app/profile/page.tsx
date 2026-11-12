'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Award, 
  Trash2, 
  Save, 
  Wrench, 
  BookOpen,
  Check,
  UploadCloud,
  FileText
} from 'lucide-react';
import { getStoredState, saveStoredState } from '@/lib/storage';
import { UserProfile } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import Link from 'next/link';
import { useResumeUpload } from '@/hooks/useResumeUpload';
import { useProfileExtraction } from '@/hooks/useProfileExtraction';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(() => getStoredState().profile);
  const [knownSkillsInput, setKnownSkillsInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savedSuccessBanner, setSavedSuccessBanner] = useState(false);

  // New tag inputs
  const [newSkillText, setNewSkillText] = useState('');
  const [newToolText, setNewToolText] = useState('');
  const [newAchievementText, setNewAchievementText] = useState('');

  // Reusable Hooks
  const { isUploading, uploadError, parseResumeFile } = useResumeUpload();
  const { isExtracting: isProcessing, extractProfile } = useProfileExtraction();

  useEffect(() => {
    const handleStorage = () => {
      setProfile(getStoredState().profile);
    };
    window.addEventListener('career_pivot_storage_updated', handleStorage);
    return () => {
      window.removeEventListener('career_pivot_storage_updated', handleStorage);
    };
  }, []);

  // Run cleanup & extraction silently in one clear step
  const handleBuildProfile = async (overrideRawText?: string, fromResume = false, overrideFileName?: string) => {
    if (!profile) return;
    const inputNarrative = overrideRawText !== undefined 
      ? overrideRawText 
      : (profile.cleanedSpeech?.trim() || profile.rawSpeech?.trim());
    
    if (!inputNarrative) {
      setStatusMessage({ text: 'Please upload a resume first.', type: 'error' });
      return;
    }

    setStatusMessage(null);
    setSavedSuccessBanner(false);

    try {
      const data = await extractProfile({
        narrativeText: inputNarrative,
        currentRole: fromResume ? undefined : profile.currentRole,
        targetRole: fromResume ? undefined : profile.targetRole,
        yearsExperience: fromResume ? undefined : profile.yearsExperience,
        knownSkills: fromResume ? undefined : knownSkillsInput,
        isFromResume: fromResume,
      });

      const extractedSkills = data.skills;
      const extractedTools = data.tools;
      const incomingAchievements = data.achievements;
      const combinedKnown = [...(extractedSkills || []), ...(extractedTools || [])].filter(Boolean).join(', ');

      const rawTextToSave = overrideRawText !== undefined ? overrideRawText : (profile.rawSpeech || inputNarrative);
      const cleanedTextToSave = data.cleanedSpeech || profile.cleanedSpeech || rawTextToSave;

      const resolvedTargetRole = fromResume
        ? (data.targetRole && data.targetRole.trim() ? data.targetRole.trim() : (profile.targetRole || ''))
        : (data.targetRole || profile.targetRole);

      const mergedSkills = fromResume
        ? (extractedSkills !== undefined && extractedSkills.length > 0 ? extractedSkills : (profile.skills || []))
        : Array.from(new Set([...(profile.skills || []), ...(extractedSkills || [])]));

      const mergedTools = fromResume
        ? (extractedTools !== undefined && extractedTools.length > 0 ? extractedTools : (profile.tools || []))
        : Array.from(new Set([...(profile.tools || []), ...(extractedTools || [])]));

      const mergedAchievements = fromResume
        ? (incomingAchievements !== undefined && incomingAchievements.length > 0 ? incomingAchievements : profile.achievements)
        : Array.from(new Set([...profile.achievements, ...(incomingAchievements || [])]));

      const updated: UserProfile = {
        ...profile,
        rawSpeech: rawTextToSave,
        cleanedSpeech: cleanedTextToSave,
        resumeFileName: overrideFileName ?? profile.resumeFileName,
        currentRole: data.currentRole || profile.currentRole || '',
        targetRole: resolvedTargetRole,
        yearsExperience: typeof data.yearsExperience === 'number' ? data.yearsExperience : (Number(data.yearsExperience) || profile.yearsExperience),
        skills: mergedSkills,
        tools: mergedTools,
        responsibilities: Array.isArray(data.responsibilities) && data.responsibilities.length > 0 ? data.responsibilities : profile.responsibilities,
        achievements: mergedAchievements,
        transferableSkills: Array.isArray(data.transferableSkills) && data.transferableSkills.length > 0 ? data.transferableSkills : profile.transferableSkills,
        lastUpdated: new Date().toISOString()
      };

      if (fromResume && combinedKnown) {
        setKnownSkillsInput(combinedKnown);
      }

      setProfile(updated);

      // Auto-save state
      const state = getStoredState();
      saveStoredState({ ...state, profile: updated });
    } catch {
      setStatusMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
    }
  };

  const handleFileUpload = async (file: File) => {
    setStatusMessage(null);
    try {
      const extractedText = await parseResumeFile(file);
      setProfile(prev => ({
        ...prev,
        rawSpeech: extractedText,
        resumeFileName: file.name
      }));

      await handleBuildProfile(extractedText, true, file.name);
    } catch {
      // Friendly error already handled in useResumeUpload
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveResume = () => {
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      rawSpeech: '',
      cleanedSpeech: '',
      resumeFileName: '',
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
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
    setTimeout(() => setSavedSuccessBanner(false), 3000);
  };

  // Add / remove tags
  const addSkill = () => {
    if (!newSkillText.trim() || !profile) return;
    const current = profile.skills || [];
    if (!current.includes(newSkillText.trim())) {
      const updated = { ...profile, skills: [...current, newSkillText.trim()] };
      setProfile(updated);
      const state = getStoredState();
      saveStoredState({ ...state, profile: updated });
    }
    setNewSkillText('');
  };

  const removeSkill = (skillToRemove: string) => {
    if (!profile) return;
    const updated = {
      ...profile,
      skills: (profile.skills || []).filter(s => s !== skillToRemove)
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
  };

  const addTool = () => {
    if (!newToolText.trim() || !profile) return;
    const current = profile.tools || [];
    if (!current.includes(newToolText.trim())) {
      const updated = { ...profile, tools: [...current, newToolText.trim()] };
      setProfile(updated);
      const state = getStoredState();
      saveStoredState({ ...state, profile: updated });
    }
    setNewToolText('');
  };

  const removeTool = (toolToRemove: string) => {
    if (!profile) return;
    const updated = {
      ...profile,
      tools: (profile.tools || []).filter(t => t !== toolToRemove)
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
  };

  const addAchievement = () => {
    if (!newAchievementText.trim() || !profile) return;
    const updated = {
      ...profile,
      achievements: [...profile.achievements, newAchievementText.trim()]
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
    setNewAchievementText('');
  };

  const removeAchievement = (index: number) => {
    if (!profile) return;
    const updated = {
      ...profile,
      achievements: profile.achievements.filter((_, i) => i !== index)
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
  };

  const removeTransferableSkill = (id: string) => {
    if (!profile) return;
    const updated = {
      ...profile,
      transferableSkills: profile.transferableSkills.filter(s => s.id !== id)
    };
    setProfile(updated);
    const state = getStoredState();
    saveStoredState({ ...state, profile: updated });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <RefreshCw className="animate-spin text-indigo-600" size={16} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your background, target role, and skills.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveAll}
            type="button"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Save size={14} className="shrink-0" />
            <span>Save Profile</span>
          </button>
        </div>
      </div>

      {/* Resume Upload Box */}
      {isUploading ? (
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-3 text-center">
          <RefreshCw size={24} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Reading your resume...
          </p>
        </div>
      ) : (profile.resumeFileName || profile.rawSpeech) ? (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {profile.resumeFileName || 'Resume uploaded'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Resume loaded and ready
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={handleRemoveResume}
              className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
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
              <UploadCloud size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Upload your resume
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Drag and drop PDF, DOCX, or TXT (up to 5 MB).
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            Choose File
          </button>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span className="font-medium">{uploadError}</span>
        </div>
      )}

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
          <span>Profile saved successfully.</span>
        </div>
      )}

      {/* AI Loading State */}
      {(isProcessing || isUploading) && (
        <AILoadingIndicator />
      )}

      {/* Background & Narrative Input */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Background & Goals
        </h2>

        {/* 3-Column Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Role
            </label>
            <input
              type="text"
              value={profile.targetRole}
              onChange={(e) => setProfile({ ...profile, targetRole: e.target.value })}
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Current / Most Recent Role
            </label>
            <input
              type="text"
              value={profile.currentRole}
              onChange={(e) => setProfile({ ...profile, currentRole: e.target.value })}
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Industry
            </label>
            <input
              type="text"
              value={profile.industry || ''}
              onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Years of Experience
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={profile.yearsExperience !== undefined && profile.yearsExperience !== null ? profile.yearsExperience : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setProfile({ ...profile, yearsExperience: val === '' ? '' : (parseFloat(val) || val) });
                  }
                }}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 font-medium"
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 select-none shrink-0">
                years
              </span>
            </div>
          </div>
        </div>

        {/* Known Skills */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            What You Already Know
          </label>
          <input
            type="text"
            value={knownSkillsInput}
            onChange={(e) => setKnownSkillsInput(e.target.value)}
            placeholder=""
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40"
          />
        </div>

        {/* One clear AI button: "Build my profile" */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => handleBuildProfile()}
            disabled={isProcessing || !profile.rawSpeech?.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isProcessing && <RefreshCw size={14} className="animate-spin shrink-0" />}
            <span>Build my profile</span>
          </button>
        </div>
      </div>

      {/* Skills & Tools */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Skills & Tools
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plain Skills */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-3">
              <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Skills ({(profile.skills || []).length})</span>
            </span>

            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
              {(profile.skills || []).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs"
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
                <span className="text-xs text-slate-400 italic">No skills added yet.</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              <input
                type="text"
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add skill..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-3">
              <Wrench size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Tools & Software ({(profile.tools || []).length})</span>
            </span>

            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
              {(profile.tools || []).map((tool, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs"
                >
                  <span>{tool}</span>
                  <button
                    type="button"
                    onClick={() => removeTool(tool)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 size={12} className="shrink-0" />
                  </button>
                </span>
              ))}
              {(!profile.tools || profile.tools.length === 0) && (
                <span className="text-xs text-slate-400 italic">No tools added yet.</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              <input
                type="text"
                value={newToolText}
                onChange={(e) => setNewToolText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                placeholder="Add tool..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addTool}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Quantifiable Accomplishments */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Award size={14} className="text-amber-500 shrink-0" />
            <span>Accomplishments ({profile.achievements.length})</span>
          </span>

          <div className="space-y-2">
            {profile.achievements.map((ach, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {ach}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAchievement(idx)}
                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer shrink-0"
                >
                  <Trash2 size={13} className="shrink-0" />
                </button>
              </div>
            ))}

            {profile.achievements.length === 0 && (
              <p className="text-xs text-slate-400 italic">No accomplishments added yet.</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <input
              type="text"
              value={newAchievementText}
              onChange={(e) => setNewAchievementText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
              placeholder="Add accomplishment..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addAchievement}
              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Translated Skills (Read-Only with short reason in small text) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Translated Skills
        </h2>

        <div className="space-y-3">
          {profile.transferableSkills.map((skill) => (
            <div 
              key={skill.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-start justify-between gap-4"
            >
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {skill.originalSkill}
                  </span>
                  <ArrowRight size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                    {skill.translatedSkill}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {skill.category}
                  </span>
                </div>
                {skill.rationale && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5">
                    {skill.rationale}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeTransferableSkill(skill.id)}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer shrink-0"
                title="Remove"
              >
                <Trash2 size={13} className="shrink-0" />
              </button>
            </div>
          ))}

          {profile.transferableSkills.length === 0 && (
            <p className="text-xs text-slate-400 italic">No translated skills yet. Click &ldquo;Build my profile&rdquo; to generate.</p>
          )}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="flex justify-end pt-2">
        <Link
          href="/skill-gaps"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
        >
          <span>Continue to Skill Gaps</span>
          <ArrowRight size={14} className="shrink-0" />
        </Link>
      </div>
    </div>
  );
}
