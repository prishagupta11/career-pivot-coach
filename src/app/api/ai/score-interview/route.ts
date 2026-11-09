import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';
import { FivePartRubric } from '@/types';

interface ScoredInterviewResponse {
  rubric: FivePartRubric;
  singleBiggestImprovement: string;
  strongerSampleAnswer: string;
  scores: {
    transferableEvidence: number;
    starStructure: number;
    domainFluency: number;
    concisenessAndImpact: number;
    totalScore: number;
  };
  feedback: {
    strengths: string[];
    improvementAreas: string[];
    suggestedBetterAnswer: string;
  };
}

export async function POST(req: Request) {
  try {
    const { 
      question, 
      userTranscript, 
      targetRole, 
      currentRole, 
      targetSkill,
      questionType,
      attemptNumber,
      previousScore 
    } = await req.json();

    if (!userTranscript || typeof userTranscript !== 'string' || !userTranscript.trim()) {
      return NextResponse.json({ error: 'Interview answer transcript is required.' }, { status: 400 });
    }

    const systemInstruction = `You are a rigorous, fair hiring manager and expert interview coach evaluating a candidate who is pivoting from "${currentRole || 'Previous Background'}" to "${targetRole || 'Target Role'}".

You MUST evaluate their spoken response against this strict, FIXED 5-PART RUBRIC:
1. relevance (1-5): Does the response directly address the specific question asked and align with the target role? Provide a one-sentence reason.
2. structure (1-5): Does the response follow a clear, logical framework (e.g. STAR: Situation, Task, Action, Result) with crisp progression? Provide a one-sentence reason.
3. specificExamples (1-5): Does the response cite concrete data, metrics, numbers, percentages, or tangible evidence rather than vague generalities? Provide a one-sentence reason.
4. technicalAccuracy (1-5): Does the response accurately use the technical terminology, methods, and tools expected in the target role (${targetRole || 'the target role'})? Provide a one-sentence reason.
5. clarity (1-5): Is the articulation concise, punchy, and clear, free of rambling or filler? Provide a one-sentence reason.

Requirements:
- Each of the 5 parts MUST have an integer score between 1 and 5 and an exact ONE-SENTENCE reason.
- Calculate totalScore as the exact sum of the 5 parts (ranging 5 to 25). maxScore is 25.
- Provide "singleBiggestImprovement": Exactly one high-impact, actionable recommendation that would yield the greatest point jump.
- Provide "strongerSampleAnswer": A first-person, highly polished model answer showing how to ace this exact question by leveraging their background.`;

    const prompt = `Candidate & Interview Details:
- Current Career: ${currentRole || 'Previous Background'}
- Target Role: ${targetRole || 'Target Role'}
- Target Skill/Competency Tested: ${targetSkill || 'Core Technical Problem Solving'}
- Question Type: ${questionType || 'technical / behavioral'}
- Attempt Number: ${attemptNumber || 1}${previousScore ? ` (Previous Score: ${previousScore}/25)` : ''}
- Question Asked: "${question}"
- Candidate's Spoken Answer (cleaned transcript):
"${userTranscript}"

Evaluate strictly against the 5-part rubric and return JSON matching the specified schema.`;

    const fallbackGenerator = (): ScoredInterviewResponse => {
      const text = userTranscript.toLowerCase();
      const words = userTranscript.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // Quantitative metrics check
      const hasNumbers = /\d+%|\$|\d+\s*(increase|decrease|percent|months|hours|students|users|records|rows|tables)/i.test(userTranscript);
      // Technical domain terms check
      const technicalMatches = (userTranscript.match(/sql|query|join|window|tableau|power bi|excel|pivot|python|pandas|dashboard|metric|kpi|variance|eda|cleaning|validation|pipeline|trend|correlation/gi) || []).length;
      // Structured action / result words
      const hasStructure = /initially|because|therefore|specifically|as a result|ended up|resulted in|led to|impact/i.test(userTranscript);
      // Direct relevance check
      const questionKeywords = question.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const matchedKeywords = questionKeywords.filter((w: string) => text.includes(w)).length;

      // Rubric Part 1: Relevance (1-5)
      const relScore = matchedKeywords >= 2 ? 5 : (matchedKeywords >= 1 || wordCount >= 30 ? 4 : 3);
      const relReason = relScore >= 4 
        ? `Directly addresses the question prompt with concrete alignment to the ${targetRole || 'target'} position.`
        : `Touches on the general topic but could align more sharply to what an interviewer in ${targetRole || 'this role'} is probing for.`;

      // Rubric Part 2: Structure (1-5)
      const structScore = hasStructure && wordCount >= 45 ? 5 : (wordCount >= 25 ? 4 : 2);
      const structReason = structScore >= 4
        ? `Follows a clear chronological narrative that transitions smoothly from the initial challenge to the final outcome.`
        : `Lacks a distinct STAR arc, leading to a somewhat abrupt jump between the action and the result.`;

      // Rubric Part 3: Specific Examples (1-5)
      const exScore = hasNumbers && wordCount >= 35 ? 5 : (hasNumbers || wordCount >= 40 ? 4 : 2);
      const exReason = exScore >= 4
        ? `Provides compelling, quantifiable evidence with concrete metrics and verifiable operational outcomes.`
        : `Relies mostly on generalized statements without enough specific quantitative metrics or measurable business results.`;

      // Rubric Part 4: Technical Accuracy (1-5)
      const techScore = technicalMatches >= 3 ? 5 : (technicalMatches >= 1 ? 4 : (wordCount > 30 ? 3 : 2));
      const techReason = techScore >= 4
        ? `Effectively incorporates target industry methodologies and terminology without slipping into irrelevant jargon.`
        : `Could elevate technical credibility by explicitly naming standard data tools, query techniques, and analytical frameworks.`;

      // Rubric Part 5: Clarity (1-5)
      const clarScore = wordCount >= 30 && wordCount <= 140 ? 5 : (wordCount < 200 ? 4 : 3);
      const clarReason = clarScore >= 4
        ? `Delivered with high signal-to-noise ratio, concise articulation, and sharp professional flow.`
        : `Contains slightly repetitive phrasing that could be trimmed for greater executive punch.`;

      const total = relScore + structScore + exScore + techScore + clarScore;

      const singleBiggestImprovement = exScore < 4
        ? `Anchor your story with 2 specific numbers (e.g. baseline failure rate vs post-intervention improvement percentage) to prove measurable ROI.`
        : techScore < 4
        ? `Swap conversational terms for precise ${targetRole || 'industry'} vocabulary, and name the specific methods and tools you used.`
        : `Emphasize the business stakeholder impact in your closing sentence to tie the technical result directly to executive decision-making.`;

      const strongerSampleAnswer = `When evaluating this in my transition to ${targetRole || 'this target role'}, I approach it systematically. In my previous experience${currentRole ? ` in ${currentRole}` : ''}, I focused on diagnosing root causes rather than relying on intuition. I structured a data-informed remediation workflow with clear metrics to isolate error patterns and track progress, driving measurable improvements in outcomes. This background confirmed that structured analysis and cross-functional communication are essential for high-impact decision making in ${targetRole || 'this position'}.`;

      return {
        rubric: {
          relevance: { score: relScore, reason: relReason },
          structure: { score: structScore, reason: structReason },
          specificExamples: { score: exScore, reason: exReason },
          technicalAccuracy: { score: techScore, reason: techReason },
          clarity: { score: clarScore, reason: clarReason },
          totalScore: total,
          maxScore: 25
        },
        singleBiggestImprovement,
        strongerSampleAnswer,
        scores: {
          transferableEvidence: exScore,
          starStructure: structScore,
          domainFluency: techScore,
          concisenessAndImpact: clarScore,
          totalScore: Math.round((total / 25) * 20)
        },
        feedback: {
          strengths: [
            relReason,
            exScore >= 4 ? `Quantifiable metrics strengthen credibility.` : `Directly addressed the interview question.`
          ],
          improvementAreas: [
            singleBiggestImprovement,
            clarReason
          ],
          suggestedBetterAnswer: strongerSampleAnswer
        }
      };
    };

    const result = await callGeminiStructured<ScoredInterviewResponse>({
      prompt,
      systemInstruction,
      schemaDescription: `{
        "rubric": {
          "relevance": { "score": 1, "reason": "string" },
          "structure": { "score": 1, "reason": "string" },
          "specificExamples": { "score": 1, "reason": "string" },
          "technicalAccuracy": { "score": 1, "reason": "string" },
          "clarity": { "score": 1, "reason": "string" },
          "totalScore": 5,
          "maxScore": 25
        },
        "singleBiggestImprovement": "string",
        "strongerSampleAnswer": "string",
        "scores": {
          "transferableEvidence": 1,
          "starStructure": 1,
          "domainFluency": 1,
          "concisenessAndImpact": 1,
          "totalScore": 4
        },
        "feedback": {
          "strengths": ["string"],
          "improvementAreas": ["string"],
          "suggestedBetterAnswer": "string"
        }
      }`,
      fallbackGenerator
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, friendlyMessage: result.friendlyMessage || 'Unable to score interview answer right now.' },
        { status: 500 }
      );
    }

    const data = result.data;
    // Ensure both rubric and scores are guaranteed and properly bounded
    if (!data.rubric) {
      data.rubric = {
        relevance: { score: 3, reason: 'Answer addressed the prompt.' },
        structure: { score: 3, reason: 'Answer demonstrated basic response structure.' },
        specificExamples: { score: 3, reason: 'Answer included examples from past experience.' },
        technicalAccuracy: { score: 3, reason: 'Answer used appropriate domain terminology.' },
        clarity: { score: 3, reason: 'Answer was articulated clearly.' },
        totalScore: 15,
        maxScore: 25
      };
    } else {
      data.rubric.relevance = data.rubric.relevance || { score: 3, reason: 'Answer addressed the prompt.' };
      data.rubric.structure = data.rubric.structure || { score: 3, reason: 'Answer demonstrated basic response structure.' };
      data.rubric.specificExamples = data.rubric.specificExamples || { score: 3, reason: 'Answer included examples from past experience.' };
      data.rubric.technicalAccuracy = data.rubric.technicalAccuracy || { score: 3, reason: 'Answer used appropriate domain terminology.' };
      data.rubric.clarity = data.rubric.clarity || { score: 3, reason: 'Answer was articulated clearly.' };

      data.rubric.relevance.score = Math.min(5, Math.max(1, Math.round(data.rubric.relevance.score || 3)));
      data.rubric.structure.score = Math.min(5, Math.max(1, Math.round(data.rubric.structure.score || 3)));
      data.rubric.specificExamples.score = Math.min(5, Math.max(1, Math.round(data.rubric.specificExamples.score || 3)));
      data.rubric.technicalAccuracy.score = Math.min(5, Math.max(1, Math.round(data.rubric.technicalAccuracy.score || 3)));
      data.rubric.clarity.score = Math.min(5, Math.max(1, Math.round(data.rubric.clarity.score || 3)));
      data.rubric.maxScore = 25;
      data.rubric.totalScore = 
        data.rubric.relevance.score + 
        data.rubric.structure.score + 
        data.rubric.specificExamples.score + 
        data.rubric.technicalAccuracy.score + 
        data.rubric.clarity.score;
    }

    // Always consistently populate scores for full backward compatibility
    const total25 = data.rubric.totalScore;
    data.scores = {
      transferableEvidence: typeof data.scores?.transferableEvidence === 'number'
        ? Math.min(5, Math.max(0, Math.round(data.scores.transferableEvidence)))
        : data.rubric.specificExamples.score,
      starStructure: typeof data.scores?.starStructure === 'number'
        ? Math.min(5, Math.max(0, Math.round(data.scores.starStructure)))
        : data.rubric.structure.score,
      domainFluency: typeof data.scores?.domainFluency === 'number'
        ? Math.min(5, Math.max(0, Math.round(data.scores.domainFluency)))
        : data.rubric.technicalAccuracy.score,
      concisenessAndImpact: typeof data.scores?.concisenessAndImpact === 'number'
        ? Math.min(5, Math.max(0, Math.round(data.scores.concisenessAndImpact)))
        : data.rubric.clarity.score,
      totalScore: typeof data.scores?.totalScore === 'number'
        ? Math.min(20, Math.max(0, Math.round(data.scores.totalScore)))
        : Math.round((total25 / 25) * 20)
    };

    return NextResponse.json({
      ...data,
      retried: result.retried,
      source: result.source,
      friendlyMessage: result.friendlyMessage
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message, friendlyMessage: 'An unexpected error occurred while scoring the interview.' }, { status: 500 });
  }
}
