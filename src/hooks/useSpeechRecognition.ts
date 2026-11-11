'use client';

import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';

export function useSpeechRecognition(onChunk?: (chunk: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onChunkRef = useRef(onChunk);

  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    () => true
  );

  useEffect(() => {
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
        if (finalChunk.trim() && onChunkRef.current) {
          onChunkRef.current(finalChunk.trim());
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      setStatusMessage('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      setStatusMessage('Recording paused.');
    } else {
      try {
        rec.start();
        setIsRecording(true);
        setStatusMessage('Listening... Speak naturally about your experience.');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'InvalidStateError') {
          setIsRecording(true);
        } else {
          console.warn('Speech start error:', err);
        }
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec && isRecording) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    speechSupported,
    statusMessage,
    toggleRecording,
    stopRecording,
  };
}
