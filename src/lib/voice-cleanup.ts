import { callGeminiStructured, GeminiStructuredResult } from './gemini';

export interface SelfCorrectionDetail {
  before: string;
  after: string;
  explanation: string;
}

export interface VoiceCleanupData {
  cleanText: string;
  originalText: string;
  fillersRemoved: string[];
  selfCorrectionsResolved: SelfCorrectionDetail[];
  wordCountOriginal: number;
  wordCountCleaned: number;
}

/**
 * Deterministic heuristic cleaner used as immediate fallback or local processor.
 */
export function heuristicVoiceCleanup(rawText: string): VoiceCleanupData {
  const fillers = [
    'um', 'uh', 'you know', 'basically', 'so yeah', 
    'sort of', 'kind of', 'i mean'
  ];

  let cleaned = rawText;
  const detectedFillers: string[] = [];
  const selfCorrections: SelfCorrectionDetail[] = [];

  // 1. Detect and resolve common self-corrections like "X, wait/actually/no Y"
  const correctionRegex = /\b(\w+(?:\s+\w+)?)\s*(?:—|,|-)\s*(?:no wait|wait|no actually|no,|actually,|sorry,|i mean|or rather)\s+(\w+(?:\s+\w+)?)\b/gi;
  cleaned = cleaned.replace(correctionRegex, (match, before, after) => {
    selfCorrections.push({
      before: match,
      after: after,
      explanation: `Resolved self-correction from "${before}" to "${after}".`
    });
    return after;
  });

  // 2. Count & remove filler words
  fillers.forEach(filler => {
    const reg = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = cleaned.match(reg);
    if (matches) {
      detectedFillers.push(...matches);
      cleaned = cleaned.replace(reg, '');
    }
  });

  // 3. Clean up residual double spaces and punctuation issues
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.?!;])/g, '$1')
    .replace(/([.?!]\s*)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  const wordCountOrig = rawText.split(/\s+/).filter(Boolean).length;
  const wordCountClean = cleaned.split(/\s+/).filter(Boolean).length;

  return {
    cleanText: cleaned || rawText,
    originalText: rawText,
    fillersRemoved: detectedFillers,
    selfCorrectionsResolved: selfCorrections,
    wordCountOriginal: wordCountOrig,
    wordCountCleaned: wordCountClean
  };
}

/**
 * Reusable Voice Cleanup function powered by Gemini with automatic single-retry and heuristic fallback.
 * Takes messy spoken text, removes verbal fillers, resolves self-corrections, and returns polished English.
 */
export async function cleanVoiceTranscript(
  rawTranscript: string, 
  contextDescription: string = 'general professional narrative'
): Promise<GeminiStructuredResult<VoiceCleanupData>> {
  if (!rawTranscript || !rawTranscript.trim()) {
    const empty = heuristicVoiceCleanup('');
    return {
      success: true,
      data: empty,
      retried: false,
      source: 'fallback'
    };
  }

  const systemInstruction = `You are an elite speech cleanup and communication coach.
Your job is to transform raw spoken audio transcripts into clear, confident, professional English.

CRITICAL INSTRUCTIONS:
1. REMOVE FILLER WORDS: Strip verbal crutches ("um", "uh", "you know", "like", "basically", "so yeah", "kind of", "sort of", "i mean").
2. RESOLVE SELF-CORRECTIONS: Whenever the speaker corrects themselves (e.g. "three—no, actually four years" -> "four years", "MySQL, I mean Postgres" -> "Postgres", "ten, wait, twelve accounts" -> "twelve accounts"), keep ONLY the final corrected thought and discard the false start.
3. FIX RUN-ONS & SYNTAX: Form clear, grammatically sound sentences without altering facts, numbers, or personal achievements.
4. DO NOT INVENT FACTS: Keep 100% of the true meaning and specifics intact.

Always return strict JSON.`;

  const prompt = `Context: ${contextDescription}
Raw Spoken Text:
"${rawTranscript}"

Respond strictly with this JSON format:
{
  "cleanText": "the fully polished, filler-free, self-correction-resolved text",
  "fillersRemoved": ["list", "of", "fillers"],
  "selfCorrectionsResolved": [
    {
      "before": "phrase as spoken with mistake and self-correction",
      "after": "resolved corrected phrase",
      "explanation": "brief reason"
    }
  ],
  "wordCountOriginal": number,
  "wordCountCleaned": number
}`;

  return callGeminiStructured<VoiceCleanupData>({
    prompt,
    systemInstruction,
    schemaDescription: '{ "cleanText": "string", "fillersRemoved": ["string"], "selfCorrectionsResolved": [{"before": "string", "after": "string", "explanation": "string"}], "wordCountOriginal": 0, "wordCountCleaned": 0 }',
    fallbackGenerator: () => heuristicVoiceCleanup(rawTranscript)
  });
}
