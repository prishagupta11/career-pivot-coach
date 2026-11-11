'use client';

import { useState, useCallback } from 'react';

export function useResumeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const parseResumeFile = useCallback(async (file: File): Promise<string> => {
    setUploadError(null);

    // Validate size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const errorMsg = 'File size exceeds 5 MB limit. Please upload a smaller file.';
      setUploadError(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'txt'];
    if (!extension || !allowed.includes(extension)) {
      const errorMsg = `Unsupported format (.${extension || 'unknown'}). Please upload a PDF, DOCX, or TXT file.`;
      setUploadError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const parseRes = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
      });

      const parseData = await parseRes.json();
      if (!parseRes.ok) {
        throw new Error(parseData.error || 'Failed to parse resume file.');
      }

      const extractedText = parseData.text;
      if (!extractedText || !extractedText.trim()) {
        throw new Error('No readable text could be extracted from this document.');
      }

      return extractedText;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process resume';
      setUploadError(message);
      throw err;
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
