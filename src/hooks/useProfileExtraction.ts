'use client';

import { useState, useCallback } from 'react';
import { TransferableSkill } from '@/types';
import { apiFetch } from '@/lib/apiClient';

export interface ExtractedProfileResult {
  currentRole?: string;
  targetRole?: string;
  yearsExperience?: number | string;
  skills?: string[];
  tools?: string[];
  responsibilities?: string[];
  achievements?: string[];
  transferableSkills?: TransferableSkill[];
  cleanedSpeech?: string;
}

export function useProfileExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const extractProfile = useCallback(
    async (params: {
      narrativeText: string;
      currentRole?: string;
      targetRole?: string;
      yearsExperience?: number | string;
      knownSkills?: string;
      isFromResume?: boolean;
    }): Promise<ExtractedProfileResult> => {
      setIsExtracting(true);
      setExtractError(null);

      try {
        const res = await apiFetch('/api/ai/extract-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            speechText: params.narrativeText,
            currentRole: params.isFromResume ? undefined : params.currentRole,
            targetRole: params.isFromResume ? undefined : params.targetRole,
            yearsExperience: params.isFromResume ? undefined : params.yearsExperience,
            knownSkills: params.isFromResume ? undefined : params.knownSkills,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.friendlyMessage || data.error || 'Failed to extract profile');
        }

        return {
          currentRole: data.currentRole,
          targetRole: data.targetRole,
          yearsExperience: typeof data.yearsExperience === 'number' ? data.yearsExperience : Number(data.yearsExperience) || undefined,
          skills: Array.isArray(data.skills) ? data.skills : [],
          tools: Array.isArray(data.tools) ? data.tools : [],
          responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
          achievements: Array.isArray(data.achievements) ? data.achievements : [],
          transferableSkills: Array.isArray(data.transferableSkills) ? data.transferableSkills : [],
          cleanedSpeech: data.cleanedSpeech || params.narrativeText,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to extract profile';
        setExtractError(msg);
        throw err;
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  return {
    isExtracting,
    extractError,
    setExtractError,
    extractProfile,
  };
}
