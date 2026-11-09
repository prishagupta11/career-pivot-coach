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

    const roleTarget = targetRole || 'Junior Data Analyst';
    const roleCurrent = currentRole || 'High School Math & Science Teacher';
    const gaps = Array.isArray(weakestSkills) && weakestSkills.length > 0 
      ? weakestSkills 
      : ['SQL & Complex Queries', 'Tableau / BI Dashboard Design', 'Data Cleansing & Validation', 'Python / Pandas EDA'];

    const systemInstruction = `You are a Principal Hiring Manager and Technical Interviewer specializing in assessing career switchers.
Your job is to generate realistic, high-signal interview questions tailored to the candidate's target role ("${roleTarget}") and their specific weakest skill gaps: ${gaps.join(', ')}.

Produce a balanced mix of:
1. Technical questions: Testing applied knowledge, syntax, querying, or troubleshooting specific to the candidate's skill gaps (e.g. SQL joins, window functions, data cleansing pipelines, dashboard KPI architecture).
2. Behavioral questions: Testing transition rationale, explaining technical numbers to non-technical stakeholders, handling ambiguous requirements, or learning technical tools quickly.

Each question must clearly state which target skill gap it probes and why it matters in hiring decisions.`;

    const prompt = `Generate 6 interview questions for a candidate transitioning from "${roleCurrent}" to "${roleTarget}".
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
}`;

    const fallbackGenerator = (): QuestionResponse => {
      const topGap1 = gaps[0] || 'SQL & Complex Joins';
      const topGap2 = gaps[1] || 'Tableau / Power BI';
      const topGap3 = gaps[2] || 'Data Cleansing & Validation';

      return {
        questions: [
          {
            id: `q-tech-1`,
            text: `In ${topGap1}, how would you construct a query or workflow to isolate and calculate month-over-month customer retention cohorts?`,
            type: 'technical',
            targetSkill: topGap1,
            contextWhy: `Evaluates applied query logic and ability to manipulate transactional data into analytical cohorts.`
          },
          {
            id: `q-tech-2`,
            text: `Walk me through your methodology for ${topGap3} when receiving unstandardized data with duplicate records, null entries, and inconsistent date formats.`,
            type: 'technical',
            targetSkill: topGap3,
            contextWhy: `Tests data engineering hygiene and real-world data readiness before dashboarding.`
          },
          {
            id: `q-tech-3`,
            text: `When designing an executive dashboard in ${topGap2}, how do you structure KPI summary tiles versus drill-down transactional views for operational leaders?`,
            type: 'technical',
            targetSkill: topGap2,
            contextWhy: `Validates visual hierarchy, BI design standards, and user-centric data presentation.`
          },
          {
            id: `q-behav-1`,
            text: `Why are you transitioning from your background in ${roleCurrent} into ${roleTarget}, and how does your previous analytical experience give you an edge?`,
            type: 'behavioral',
            targetSkill: 'Pivot Rationale & Storytelling',
            contextWhy: `Assesses self-awareness, authentic motivation, and ability to pitch transferable value.`
          },
          {
            id: `q-behav-2`,
            text: `Describe a scenario where you had to explain complex quantitative data or metric discrepancies to non-technical stakeholders who were skeptical of the findings.`,
            type: 'behavioral',
            targetSkill: 'Cross-Functional Stakeholder Communication',
            contextWhy: `Determines whether the candidate can bridge technical findings with actionable business decisions.`
          },
          {
            id: `q-behav-3`,
            text: `Tell me about a time when an analytical project hit a roadblock or your initial hypothesis proved incorrect. How did you pivot your strategy?`,
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
