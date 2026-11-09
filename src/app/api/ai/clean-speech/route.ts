import { NextResponse } from 'next/server';
import { cleanVoiceTranscript } from '@/lib/voice-cleanup';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawSpeech = body.rawSpeech || body.rawTranscript || body.text;

    if (!rawSpeech || typeof rawSpeech !== 'string' || !rawSpeech.trim()) {
      return NextResponse.json(
        { error: 'Speech text is required.' },
        { status: 400 }
      );
    }

    const MAX_SPEECH_LENGTH = 30000;
    if (rawSpeech.length > MAX_SPEECH_LENGTH) {
      return NextResponse.json(
        { error: `Speech text exceeds maximum length of ${MAX_SPEECH_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const context = body.context || 'career narrative or interview answer';
    const result = await cleanVoiceTranscript(rawSpeech, context);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'CLEANUP_FAILED',
          friendlyMessage: result.friendlyMessage || 'Unable to clean speech transcript right now.'
        },
        { status: 500 }
      );
    }

    // Return both legacy key cleanedSpeech and rich cleanText data
    return NextResponse.json({
      cleanedSpeech: result.data.cleanText,
      cleanText: result.data.cleanText,
      details: result.data,
      retried: result.retried,
      source: result.source,
      friendlyMessage: result.friendlyMessage
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message, friendlyMessage: 'An unexpected server error occurred during voice cleanup.' },
      { status: 500 }
    );
  }
}
