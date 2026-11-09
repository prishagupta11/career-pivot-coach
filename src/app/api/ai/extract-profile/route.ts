import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';
import { cleanVoiceTranscript } from '@/lib/voice-cleanup';
import { TransferableSkill } from '@/types';

interface ExtractedProfilePayload {
  currentRole: string;
  targetRole: string;
  yearsExperience: number;
  skills: string[];
  tools: string[];
  responsibilities: string[];
  achievements: string[];
  transferableSkills: Array<{
    originalSkill: string;
    translatedSkill: string;
    category: 'Technical' | 'Domain' | 'Soft Skill' | 'Tool';
    rationale: string;
    strengthLevel: 'Foundational' | 'Intermediate' | 'Advanced';
  }>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      rawSpeech, 
      speechText, 
      cleanedSpeech: inputCleanedSpeech, 
      currentRole: inputCurrentRole, 
      targetRole: inputTargetRole, 
      yearsExperience: inputYearsExp,
      knownSkills: inputKnownSkills 
    } = body;

    const sourceText = (inputCleanedSpeech || rawSpeech || speechText || '').trim();

    if (!sourceText) {
      return NextResponse.json({ error: 'Background narrative or resume text is required.' }, { status: 400 });
    }

    // Step 1: Ensure we have clean speech (prioritizing cleaned speech if already supplied)
    let finalCleanedSpeech = inputCleanedSpeech?.trim();
    if (!finalCleanedSpeech) {
      const cleanResult = await cleanVoiceTranscript(sourceText, 'Candidate career background');
      finalCleanedSpeech = cleanResult.data.cleanText;
    }

    const systemInstruction = `You are a premier executive career transition strategist and talent assessor for "Career Pivot Coach".
Your goal is to parse a professional's background narrative, resume, and what they already know, and extract a tidy, structured profile while translating their past experience into the currency of their TARGET ROLE.

CRITICAL INSTRUCTIONS:
1. EXTRACT TIDY PROFILE:
   - "currentRole": The candidate's past or current title (e.g., "Accountant", "Store Manager", "Project Coordinator"). If provided by user, refine or confirm it.
   - "targetRole": The role they are pivoting into. Leave empty ("") UNLESS it is explicitly specified by the user or explicitly stated in the resume/narrative (e.g. in an objective or summary). Do not invent or default to an unmentioned target role.
   - "yearsExperience": Estimate or extract total professional years (integer, e.g. 5).
   - "skills": List 5-8 concrete skills demonstrated in their background or specified in what they already know.
   - "tools": List 4-8 specific software, programming languages, platforms, or tools they used or know.
   - "responsibilities": 3-5 structured, active-voice responsibilities from their background.
   - "achievements": 2-4 quantifiable, impact-oriented achievements (highlight numbers, %, improvements).

2. SKILLS TRANSLATOR (MAPPING OLD EXPERIENCE TO TARGET ROLE CURRENCY):
   - Take the portions of old experience and map them into skills that matter in professional modern roles (or the target role if known).
   - For each transferable skill, provide:
     * "originalSkill": The original thing they did in their current/past role.
     * "translatedSkill": The translated skill in modern business currency.
     * "rationale": Why it counts to hiring managers.
     * "category": One of 'Technical' | 'Domain' | 'Soft Skill' | 'Tool'
     * "strengthLevel": 'Foundational' | 'Intermediate' | 'Advanced'

Return strictly a valid JSON object matching the requested schema.`;

    const prompt = `Candidate Transition Context:
- Current / Past Role: ${inputCurrentRole || 'Infer from text'}
- Target Role: ${inputTargetRole || 'Leave empty string "" unless explicitly specified in candidate text'}
- Years of Experience: ${inputYearsExp || 'Infer from text'}
- What they already know / existing skills: ${inputKnownSkills || 'Extract from background'}

Candidate Background Narrative / Resume:
"${finalCleanedSpeech}"

Respond ONLY with this JSON schema:
{
  "currentRole": "string",
  "targetRole": "string",
  "yearsExperience": 5,
  "skills": ["string"],
  "tools": ["string"],
  "responsibilities": ["string"],
  "achievements": ["string"],
  "transferableSkills": [
    {
      "originalSkill": "string",
      "translatedSkill": "string",
      "category": "Technical",
      "rationale": "string",
      "strengthLevel": "Intermediate"
    }
  ]
}`;

    const fallbackGenerator = (): ExtractedProfilePayload => {
      const sentences = finalCleanedSpeech
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 15);

      const resolvedCurrentRole = inputCurrentRole || "Professional";
      const resolvedTargetRole = inputTargetRole || "";
      const resolvedYears = Number(inputYearsExp) || 3;

      return {
        currentRole: resolvedCurrentRole,
        targetRole: resolvedTargetRole,
        yearsExperience: resolvedYears,
        skills: [
          "Operational Workflow Analysis",
          "Process Optimization",
          "Stakeholder Communication",
          "Metric Benchmarking",
          "Documentation & Reporting"
        ],
        tools: [
          "Microsoft Excel",
          "Google Workspace",
          "Project Management Tools"
        ],
        responsibilities: [
          `Executed core ${resolvedCurrentRole} responsibilities, standardizing workflows and reporting metrics`,
          sentences[0] || 'Managed daily operations, tracking metrics and cohort performance',
          sentences[1] || 'Collaborated with diverse stakeholders to communicate status and resolve operational challenges'
        ],
        achievements: sentences
          .filter((s: string) => /\d+%|\$|\d+\s*(increase|decrease|growth|saving|reduction|improvement)/i.test(s))
          .slice(0, 3),
        transferableSkills: []
      };
    };

    const result = await callGeminiStructured<ExtractedProfilePayload>({
      prompt,
      systemInstruction,
      schemaDescription: '{ "currentRole": "string", "targetRole": "string", "yearsExperience": 0, "skills": [], "tools": [], "responsibilities": [], "achievements": [], "transferableSkills": [] }',
      fallbackGenerator
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error, 
          friendlyMessage: result.friendlyMessage || 'Unable to extract profile narrative at this moment.' 
        },
        { status: 500 }
      );
    }

    const skillsWithIds: TransferableSkill[] = (result.data.transferableSkills || []).map(
      (skill, index: number) => ({
        ...skill,
        id: `ts-${Date.now()}-${index}`
      })
    );

    const safeCurrentRole = (typeof result.data.currentRole === 'string' && result.data.currentRole.trim())
      ? result.data.currentRole.trim()
      : (typeof inputCurrentRole === 'string' && inputCurrentRole.trim() ? inputCurrentRole.trim() : 'Career Transitioner');

    const safeTargetRole = (typeof result.data.targetRole === 'string' && result.data.targetRole.trim())
      ? result.data.targetRole.trim()
      : (typeof inputTargetRole === 'string' && inputTargetRole.trim() ? inputTargetRole.trim() : '');

    const parsedYears = Number(result.data.yearsExperience);
    const fallbackYears = Number(inputYearsExp);
    const safeYearsExperience = !isNaN(parsedYears) && parsedYears >= 0
      ? parsedYears
      : (!isNaN(fallbackYears) && fallbackYears >= 0 ? fallbackYears : 3);

    return NextResponse.json({
      cleanedSpeech: finalCleanedSpeech,
      currentRole: safeCurrentRole,
      targetRole: safeTargetRole,
      yearsExperience: safeYearsExperience,
      skills: Array.isArray(result.data.skills) ? result.data.skills : [],
      tools: Array.isArray(result.data.tools) ? result.data.tools : [],
      responsibilities: Array.isArray(result.data.responsibilities) ? result.data.responsibilities : [],
      achievements: Array.isArray(result.data.achievements) ? result.data.achievements : [],
      transferableSkills: skillsWithIds,
      retried: result.retried,
      source: result.source,
      friendlyMessage: result.friendlyMessage
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message, friendlyMessage: 'An unexpected error occurred while processing profile extraction.' },
      { status: 500 }
    );
  }
}
