import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';

export interface GeneratedQuestion {
  id: string;
  text: string;
  type: 'technical' | 'behavioral';
  targetSkill: string;
  contextWhy: string;
}

interface QuestionResponse {
  questions: GeneratedQuestion[];
}

export async function POST(req: Request) {
  try {
    const { targetRole, currentRole, weakestSkills, type } = await req.json();

    const roleTarget = targetRole || 'Target Role';
    const roleCurrent = currentRole || '';
    const gaps = Array.isArray(weakestSkills) && weakestSkills.length > 0 
      ? weakestSkills 
      : ['Applied Problem Solving', 'Domain Terminology & Workflows', 'Quality Validation & Testing', 'Cross-Functional Communication'];

    const systemInstruction = `You are a Principal Hiring Manager and Technical Interviewer specializing in assessing career switchers.
Your job is to generate realistic, high-signal interview questions tailored to the candidate's target role ("${roleTarget}") and their specific weakest skill gaps: ${gaps.join(', ')}.

Produce a balanced mix of:
1. Technical questions: Testing applied knowledge, syntax, querying, or troubleshooting specific to the candidate's skill gaps (e.g. data cleansing, workflows, domain tooling, metric architecture).
2. Behavioral questions: Testing transition rationale, explaining domain concepts to non-technical stakeholders, handling ambiguous requirements, or learning technical tools quickly.

Each question must clearly state which target skill gap it probes and why it matters in hiring decisions.`;

    const prompt = `Generate 6 interview questions for a candidate pivoting${roleCurrent ? ` from "${roleCurrent}"` : ''} into "${roleTarget}".
Candidate's key skill gaps: ${gaps.join(', ')}.
Requested category: ${type || 'mixed technical and behavioral'}.

Return JSON strictly matching this schema:
{
  "questions": [
    {
      "id": "q-1",
      "text": "The question text to ask the candidate",
      "type": "technical" | "behavioral",
      "targetSkill": "Name of the specific skill gap targeted",
      "contextWhy": "One sentence explaining why hiring managers ask this for the target role"
    }
  ]
}

Ensure the questions explicitly reference "${roleTarget}" and the candidate's actual skill gaps (${gaps.join(', ')}). Never invent an unrelated role.`;

    const fallbackGenerator = (): QuestionResponse => {
      const topGap1 = gaps[0] || 'Domain Problem Solving';
      const topGap2 = gaps[1] || 'Industry Tooling & Workflow';
      const topGap3 = gaps[2] || 'Quality & Diagnostic Validation';

      return {
        questions: [
          {
            id: `q-tech-1`,
            text: `In ${topGap1}, how would you construct a solution or analytical workflow to isolate root causes and measure outcome metrics for ${roleTarget}?`,
            type: 'technical',
            targetSkill: topGap1,
            contextWhy: `Evaluates applied domain execution logic and ability to manipulate inputs into validated business outcomes.`
          },
          {
            id: `q-tech-2`,
            text: `Walk me through your methodology for ${topGap3} when receiving incomplete or inconsistent specifications in ${roleTarget}.`,
            type: 'technical',
            targetSkill: topGap3,
            contextWhy: `Tests quality hygiene standards and diagnostic problem-solving before deploying solutions.`
          },
          {
            id: `q-tech-3`,
            text: `When implementing a project in ${topGap2}, how do you structure operational deliverables versus summary metrics for leadership?`,
            type: 'technical',
            targetSkill: topGap2,
            contextWhy: `Validates visual hierarchy, tooling standards, and user-centric presentation.`
          },
          {
            id: `q-behav-1`,
            text: roleCurrent
              ? `Why are you transitioning from your background in ${roleCurrent} into ${roleTarget}, and how does your previous experience give you an edge?`
              : `Why are you pivoting into ${roleTarget}, and how does your previous experience make you uniquely valuable?`,
            type: 'behavioral',
            targetSkill: 'Pivot Rationale & Storytelling',
            contextWhy: `Assesses self-awareness, authentic motivation, and ability to pitch transferable value.`
          },
          {
            id: `q-behav-2`,
            text: `Describe a scenario where you had to explain complex domain metrics or data discrepancies to stakeholders who were skeptical of the findings in ${roleTarget}.`,
            type: 'behavioral',
            targetSkill: 'Cross-Functional Stakeholder Communication',
            contextWhy: `Determines whether the candidate can bridge technical findings with actionable business decisions.`
          },
          {
            id: `q-behav-3`,
            text: `Tell me about a time when an analytical or implementation task in ${roleTarget} hit a roadblock or your initial hypothesis proved incorrect. How did you diagnose and adjust?`,
            type: 'behavioral',
            targetSkill: 'Root Cause Problem Solving & Resilience',
            contextWhy: `Probes intellectual honesty, analytical rigor, and adaptability under uncertainty.`
          }
        ]
      };
    };

    const result = await callGeminiStructured<QuestionResponse>({
      prompt,
      systemInstruction,
      schemaDescription: `{ "questions": [{ "id": "string", "text": "string", "type": "technical", "targetSkill": "string", "contextWhy": "string" }] }`,
      fallbackGenerator
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, friendlyMessage: result.friendlyMessage }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
