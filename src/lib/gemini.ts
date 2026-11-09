import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface GeminiStructuredResult<T> {
  success: boolean;
  data: T;
  retried: boolean;
  error?: string;
  friendlyMessage?: string;
  source: 'gemini' | 'fallback';
}

/**
 * Extracts and cleans a JSON string from model response, stripping any markdown codeblocks.
 */
function cleanJsonString(rawText: string): string {
  const trimmed = rawText.trim();
  // Match ```json ... ``` or ``` ... ``` anywhere in the response
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // If no fences, locate root JSON object { ... } or array [ ... ]
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');

  const hasBraces = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const hasBrackets = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

  if (hasBraces && (!hasBrackets || firstBrace < firstBracket)) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  } else if (hasBrackets) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  return trimmed;
}

/**
 * Robust server-side Gemini helper that always returns structured JSON.
 * - Auto-retries once if the first output fails JSON parsing or validation.
 * - Provides a friendly human error message if both attempts fail.
 * - Falls back to a deterministic generator if provided (e.g. when no API key is configured).
 */
export async function callGeminiStructured<T>(options: {
  prompt: string;
  systemInstruction?: string;
  schemaDescription?: string;
  validate?: (data: unknown) => boolean;
  fallbackGenerator?: () => T;
}): Promise<GeminiStructuredResult<T>> {
  const { prompt, systemInstruction, schemaDescription, validate, fallbackGenerator } = options;

  // If no Gemini API key is configured, gracefully use the fallback generator
  if (!ai || !apiKey) {
    if (fallbackGenerator) {
      return {
        success: true,
        data: fallbackGenerator(),
        retried: false,
        source: 'fallback',
        friendlyMessage: 'Running with local intelligent transition engine. (Add GEMINI_API_KEY to .env.local for live cloud synthesis).'
      };
    }
    return {
      success: false,
      data: null as unknown as T,
      retried: false,
      source: 'fallback',
      error: 'GEMINI_API_KEY_MISSING',
      friendlyMessage: 'Gemini API key is not configured in .env.local. Please provide a key to activate cloud AI features.'
    };
  }

  const modelName = 'gemini-3.8-flash';

  // --- ATTEMPT 1 ---
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an elite career transition advisor and communication coach. Always respond with strict, valid JSON.',
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '';
    const cleaned = cleanJsonString(rawText);
    const parsed = JSON.parse(cleaned) as T;
    if (validate && !validate(parsed)) {
      throw new Error('Model output failed validation');
    }

    return {
      success: true,
      data: parsed,
      retried: false,
      source: 'gemini'
    };
  } catch (firstError) {
    console.warn('Gemini Attempt 1 failed or returned invalid JSON. Retrying once...', firstError);

    // --- ATTEMPT 2 (RETRY ONCE) ---
    try {
      const retryPrompt = `Your previous response could not be parsed as valid JSON.
Please provide ONLY strict, valid JSON matching this schema:
${schemaDescription || '{ "result": ... }'}

Do not include any explanations, greetings, or markdown code fences outside the JSON.

Original Request:
${prompt}`;

      const retryResponse = await ai.models.generateContent({
        model: modelName,
        contents: retryPrompt,
        config: {
          systemInstruction: 'You must return strictly valid JSON. Fix any trailing commas, unescaped characters, or formatting errors.',
          responseMimeType: 'application/json'
        }
      });

      const retryText = retryResponse.text || '';
      const retryCleaned = cleanJsonString(retryText);
      const retryParsed = JSON.parse(retryCleaned) as T;
      if (validate && !validate(retryParsed)) {
        throw new Error('Model retry output failed validation');
      }

      return {
        success: true,
        data: retryParsed,
        retried: true,
        source: 'gemini'
      };
    } catch (secondError) {
      console.error('Gemini Attempt 2 (retry) also failed:', secondError);

      // If a fallback is available, serve it with a polite friendly note
      if (fallbackGenerator) {
        return {
          success: true,
          data: fallbackGenerator(),
          retried: true,
          source: 'fallback',
          friendlyMessage: 'The AI model had trouble formatting its output, so we safely processed your request using our local backup engine.'
        };
      }

      // Otherwise return friendly error
      return {
        success: false,
        data: null as unknown as T,
        retried: true,
        source: 'gemini',
        error: secondError instanceof Error ? secondError.message : 'JSON_PARSE_ERROR',
        friendlyMessage: 'We had trouble generating a structured response from the AI. Please try re-submitting with slightly simpler text or check your connection.'
      };
    }
  }
}
