'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/apiClient';

const FRIENDLY_ERROR = "We couldn't read this file. Try a different PDF, DOCX or TXT.";

export function useResumeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const parseResumeFile = useCallback(async (file: File): Promise<string> => {
    setUploadError(null);

    // Validate size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(FRIENDLY_ERROR);
      throw new Error(FRIENDLY_ERROR);
    }

    // Validate extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'txt'];
    if (!extension || !allowed.includes(extension)) {
      setUploadError(FRIENDLY_ERROR);
      throw new Error(FRIENDLY_ERROR);
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const parseRes = await apiFetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok) {
        throw new Error(FRIENDLY_ERROR);
      }

      const extractedText = parseData.text;
      if (!extractedText || !extractedText.trim()) {
        throw new Error(FRIENDLY_ERROR);
      }

      return extractedText;
    } catch {
      setUploadError(FRIENDLY_ERROR);
      throw new Error(FRIENDLY_ERROR);
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    isUploading,
    uploadError,
    setUploadError,
    parseResumeFile,
  };
}
