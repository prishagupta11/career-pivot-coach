import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';
import { UserProfile, TransferableSkill, JobPosting, SkillGapItem, CandidateMatchStatus, SkillCategory, GapSeverity } from '@/types';
import { verifyAuth } from '@/lib/serverAuth';

interface MapSkillGapsPayload {
  overallMatchPercentage: number;
  criticalGapsCount: number;
  skills: Array<{
    skillName: string;
    category: SkillCategory;
    mentionedInJobIds?: string[];
    postingsCount: number;
    totalPostings: number;
    frequencyPercent: number;
    matchStatus: CandidateMatchStatus;
    gapSeverity: GapSeverity;
    reason: string;
    provenPhrase: string;
    skillContext: string;
    learningSuggestions: string;
    recommendation: string;
  }>;
}

export async function POST(req: Request) {
  const authResult = await verifyAuth(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { 
      profile, 
      transferableSkills = [], 
      jobPostings = [] 
    } = body as {
      profile: UserProfile;
      transferableSkills: TransferableSkill[];
      jobPostings: JobPosting[];
    };

    if (!jobPostings || !Array.isArray(jobPostings) || jobPostings.length === 0) {
      return NextResponse.json(
        { error: 'At least one job description is required to perform skill gap analysis.' },
        { status: 400 }
      );
    }

    const totalPostings = jobPostings.length;

    // Build postings text for prompt
    const postingsText = jobPostings
      .map((jp, i) => `--- JOB POSTING ${i + 1}: ${jp.company} - ${jp.title} ---\n${jp.rawText}`)
      .join('\n\n');

    // Build candidate profile summary
    const candidateSummary = `
- Target Role: ${profile?.targetRole || 'Not specified'}
- Current Role: ${profile?.currentRole || 'Not specified'} (${profile?.yearsExperience || 0} years experience)
- Existing Known Skills: ${(profile?.skills || []).join(', ') || 'Not specified'}
- Tools & Software: ${(profile?.tools || []).join(', ') || 'Not specified'}
- Key Achievements: ${(profile?.achievements || []).join(' | ') || 'None provided'}
- Background Summary: ${profile?.cleanedSpeech || profile?.rawSpeech || 'None provided'}

- Translated Transferable Skills (from past experience):
${(transferableSkills || profile?.transferableSkills || []).map(ts => 
  `* [${ts.category}] ${ts.translatedSkill} (from original: "${ts.originalSkill}") - Level: ${ts.strengthLevel}. Rationale: ${ts.rationale}`
).join('\n') || 'None translated yet'}
`;

    const systemInstruction = `You are an elite Talent Intelligence Analyst and Transition Strategist for "Career Pivot Coach".
Your goal is to perform an empirical, evidence-based Skill Gap Analysis comparing a candidate's background against real target role job descriptions.

CRITICAL INSTRUCTIONS:
1. EXTRACT COMMON DEMANDED SKILLS:
   - Identify 5 to 8 distinct skills that the job postings specifically ask for.
   - For each skill:
     * "skillName": Industry standard, specific title (e.g. "SQL (Complex Queries & Aggregations)", "Tableau or Power BI Dashboards", "Advanced Microsoft Excel", "Executive Stakeholder Storytelling").
     * "category": One of 'Technical' | 'Domain' | 'Soft Skill' | 'Tool'
     * "postingsCount": Integer count of how many postings explicitly mention or require this skill (out of ${totalPostings}).
     * "totalPostings": ${totalPostings}.
     * "frequencyPercent": Math.round((postingsCount / ${totalPostings}) * 100).
     * "matchStatus": Exactly one of:
         - 'has': Candidate's profile, tools, or translated skills provide clear evidence.
         - 'partly': Candidate has foundational, academic, or adjacent background, but lacks enterprise/production depth.
         - 'lacks': Candidate has no documented evidence.
     * "reason": 1-2 sentence candid explanation for why they have it, partly have it, or lack it based on their profile.
     * "provenPhrase": MUST BE A DIRECT, EXACT SHORT PHRASE FROM ONE OF THE PROVIDED JOB POSTINGS THAT PROVES THE REQUIREMENT. DO NOT INVENT THIS PHRASE.
     * "skillContext": 1-2 informative sentences about the skill: why employers test it, industry standards, or where it fits in the target role.
     * "learningSuggestions": Concrete advice on how the candidate can learn or bridge this skill (e.g. recommended project, tutorial, or exercise).
     * "gapSeverity": 'Critical' (if lacks and frequency >= 50%), 'Moderate' (if partly or frequency < 50%), 'Good' (if has with intermediate level), or 'Strong' (if has with advanced level).
     * "recommendation": A crisp action item for their resume or learning plan.

2. OVERALL MATCH SCORE:
   - "overallMatchPercentage": 0-100 calculated from matched skills.
   - "criticalGapsCount": Count of skills with matchStatus 'lacks' and frequencyPercent >= 50.

Return strictly a valid JSON object matching the requested schema.`;

    const prompt = `CANDIDATE BACKGROUND & TRANSLATED ASSETS:
${candidateSummary}

TARGET JOB POSTINGS TO ANALYZE (${totalPostings} Total):
${postingsText}

Respond ONLY with this JSON schema:
{
  "overallMatchPercentage": 60,
  "criticalGapsCount": 2,
  "skills": [
    {
      "skillName": "SQL (Relational Queries & JOINs)",
      "category": "Technical",
      "postingsCount": ${totalPostings},
      "totalPostings": ${totalPostings},
      "frequencyPercent": 100,
      "matchStatus": "lacks",
      "gapSeverity": "Critical",
      "reason": "Candidate has strong spreadsheet experience, but no demonstrated SQL querying experience.",
      "provenPhrase": "quoted phrase directly from job posting",
      "skillContext": "SQL is required to query production relational databases in 90%+ of analytics roles.",
      "learningSuggestions": "Complete PostgreSQL interactive exercises and build a multi-table querying project.",
      "recommendation": "Master SQL JOINs, aggregations, and CTEs."
    }
  ]
}`;

    const fallbackGenerator = (): MapSkillGapsPayload => {
      // Deterministic intelligent heuristic analyzer
      const combinedText = jobPostings.map(j => j.rawText).join(' ');
      const skillsFound: Array<{
        name: string;
        cat: SkillCategory;
        regex: RegExp;
        hasRegex: RegExp;
        context: string;
        suggestion: string;
      }> = [
        {
          name: 'SQL (PostgreSQL / Relational Queries)',
          cat: 'Technical',
          regex: /\bsql\b|\bpostgres\b|\bqueries\b|\bquerying\b|\bdatabase\b/i,
          hasRegex: /\bsql\b|\bpostgres\b|\bmysql\b/i,
          context: 'SQL is the non-negotiable benchmark in 90%+ of data screens. Employers evaluate multi-table joins and aggregation logic.',
          suggestion: 'Complete interactive PostgreSQL practice on Mode Analytics or LeetCode Database. Build a multi-table schema project.'
        },
        {
          name: 'BI Dashboard Visualization (Tableau or Power BI)',
          cat: 'Tool',
          regex: /\btableau\b|\bpower\s*bi\b|\bdashboards?\b|\blooker\b/i,
          hasRegex: /\btableau\b|\bpower\s*bi\b|\blooker\b/i,
          context: 'Enterprise teams deploy Tableau and Power BI to share automated KPIs with non-technical department leaders.',
          suggestion: 'Publish 2 interactive dashboards on Tableau Public with calculated fields, filters, and drill-downs.'
        },
        {
          name: 'Microsoft Excel (Advanced / Pivot Tables & Modeling)',
          cat: 'Tool',
          regex: /\bexcel\b|\bspreadsheets?\b|\bpivot\s*tables?\b|\bvlookup\b/i,
          hasRegex: /\bexcel\b|\bspreadsheets?\b|\bpivot\b/i,
          context: 'Excel remains the universal tool for ad-hoc variance checks, financial modeling, and early prototype analysis.',
          suggestion: 'Highlight 6 years of advanced multi-tab modeling and diagnostic dashboard design in your resume header.'
        },
        {
          name: 'Executive Stakeholder Reporting & Data Storytelling',
          cat: 'Soft Skill',
          regex: /\bcommunication\b|\bpresent\b|\bpresenting\b|\bstakeholders?\b|\bstorytelling\b/i,
          hasRegex: /\bpresent\b|\bpresentation\b|\bcommunication\b|\bstakeholder\b|\bparents\b|\badministrators\b/i,
          context: 'The primary differentiator for high-performing analysts is translating quantitative data into non-technical business actions.',
          suggestion: 'Frame past quarterly administrative presentations as cross-functional stakeholder alignment and executive reporting.'
        },
        {
          name: 'KPI Benchmarking & Metric Definition',
          cat: 'Domain',
          regex: /\bkpi\b|\bmetrics?\b|\bbenchmarking\b|\bretention\b|\btracking\b/i,
          hasRegex: /\bkpi\b|\bmetrics?\b|\bbenchmarking\b|\bdiagnostic\b|\bexam\s*rates\b/i,
          context: 'Tracking leading and lagging performance metrics is vital for understanding sprint velocity and business outcomes.',
          suggestion: 'Present past cohort performance diagnostics as retention KPI benchmarking during technical interviews.'
        },
        {
          name: 'Python for Data Analysis (Pandas & Scripting)',
          cat: 'Technical',
          regex: /\bpython\b|\bpandas\b|\bnumpy\b|\bscripting\b/i,
          hasRegex: /\bpython\b|\bpandas\b/i,
          context: 'Python provides programmatic scalability when tabular datasets exceed spreadsheet limits.',
          suggestion: 'Learn basic Pandas dataframes (filtering, groupby, merging) to automate recurring data cleaning tasks.'
        }
      ];

      const profileText = `${profile?.cleanedSpeech || ''} ${profile?.rawSpeech || ''} ${(profile?.skills || []).join(' ')} ${(profile?.tools || []).join(' ')} ${(transferableSkills || []).map(t => `${t.originalSkill} ${t.translatedSkill}`).join(' ')}`;

      const results = skillsFound.map((item) => {
        // Count how many postings mention it
        let count = 0;
        let proof = 'Required across target role postings';
        const matchingJobIds: string[] = [];
        
        jobPostings.forEach(jp => {
          if (item.regex.test(jp.rawText) || item.regex.test(jp.title)) {
            count++;
            matchingJobIds.push(jp.id);
            // Find a sentence matching regex for proof
            const sentences = jp.rawText.split(/[.;\n]+/).map(s => s.trim()).filter(Boolean);
            const foundSentence = sentences.find(s => item.regex.test(s));
            if (foundSentence && foundSentence.length < 160) {
              proof = foundSentence;
            }
          }
        });

        // Ensure at least 1 count if regex matched combined
        if (count === 0 && item.regex.test(combinedText)) {
          count = 1;
          if (jobPostings[0]) matchingJobIds.push(jobPostings[0].id);
        }

        const freq = Math.round((count / Math.max(totalPostings, 1)) * 100);

        // Check candidate match status
        const candidateHas = item.hasRegex.test(profileText);
        let matchStatus: CandidateMatchStatus = candidateHas ? 'has' : 'lacks';
        if (!candidateHas && (item.name.includes('Python') || item.name.includes('KPI'))) {
          // If candidate knows math/spreadsheets, python or KPI could be partly
          matchStatus = 'partly';
        }

        let gapSeverity: GapSeverity = 'Good';
        if (matchStatus === 'lacks') {
          gapSeverity = freq >= 60 ? 'Critical' : 'Moderate';
        } else if (matchStatus === 'partly') {
          gapSeverity = 'Moderate';
        } else {
          gapSeverity = freq >= 75 ? 'Strong' : 'Good';
        }

        let reason = '';
        if (matchStatus === 'has') {
          reason = `Verified strength: Candidate background documents practical hands-on application in ${item.name}.`;
        } else if (matchStatus === 'partly') {
          reason = `Candidate has foundational conceptual or spreadsheet knowledge, but lacks production enterprise depth in ${item.name}.`;
        } else {
          reason = `Candidate profile has no documented evidence of applying ${item.name} in practical work.`;
        }

        return {
          skillName: item.name,
          category: item.cat,
          mentionedInJobIds: matchingJobIds.length > 0 ? matchingJobIds : [jobPostings[0]?.id || 'job-1'],
          postingsCount: count,
          totalPostings,
          frequencyPercent: freq,
          matchStatus,
          gapSeverity,
          reason,
          provenPhrase: proof,
          skillContext: item.context,
          learningSuggestions: item.suggestion,
          recommendation: matchStatus === 'has' 
            ? `Highlight this verified strength prominently in resume and interview narratives.`
            : `Prioritize bridging this skill in your week-by-week learning plan.`
        };
      }).filter(s => s.postingsCount > 0);

      const matchedCount = results.filter(r => r.matchStatus === 'has').length;
      const partlyCount = results.filter(r => r.matchStatus === 'partly').length;
      const matchPct = Math.round(((matchedCount + (partlyCount * 0.5)) / Math.max(results.length, 1)) * 100);
      const criticalCount = results.filter(r => r.matchStatus === 'lacks' && r.frequencyPercent >= 50).length;

      return {
        overallMatchPercentage: matchPct,
        criticalGapsCount: criticalCount,
        skills: results
      };
    };

    const result = await callGeminiStructured<MapSkillGapsPayload>({
      prompt,
      systemInstruction,
      schemaDescription: '{ "overallMatchPercentage": 0, "criticalGapsCount": 0, "skills": [] }',
      fallbackGenerator
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error, 
          friendlyMessage: result.friendlyMessage || 'Unable to map skill gaps at this moment.' 
        },
        { status: 500 }
      );
    }

    // Sort the most demanded missing skills to the top:
    // Priority:
    // 1. matchStatus === 'lacks', sorted descending by frequencyPercent
    // 2. matchStatus === 'partly', sorted descending by frequencyPercent
    // 3. matchStatus === 'has', sorted descending by frequencyPercent
    const validJobIds = new Set(jobPostings.map(j => j.id));

    const sortedSkills: SkillGapItem[] = (result.data.skills || []).map((skill, index) => {
      // Preserve the AI's matched job IDs, filtering against valid IDs from jobPostings
      const aiJobIds = Array.isArray(skill.mentionedInJobIds)
        ? skill.mentionedInJobIds.filter(id => validJobIds.has(id))
        : [];

      let finalJobIds = aiJobIds;
      if (finalJobIds.length === 0) {
        // Fallback: match based on skill name in job posting text or title
        const matched = jobPostings.filter(jp => {
          const lower = (skill.skillName || '').toLowerCase();
          return jp.rawText.toLowerCase().includes(lower) || jp.title.toLowerCase().includes(lower);
        }).map(jp => jp.id);

        if (matched.length > 0) {
          finalJobIds = matched;
        } else {
          // If still no direct match, take slice according to postingsCount or default subset
          const targetCount = Math.min(
            totalPostings,
            Math.max(1, typeof skill.postingsCount === 'number' && skill.postingsCount > 0
              ? skill.postingsCount
              : Math.round(((skill.frequencyPercent || 50) / 100) * totalPostings)
            )
          );
          finalJobIds = jobPostings.slice(0, targetCount).map(jp => jp.id);
        }
      }

      const calculatedPostingsCount = typeof skill.postingsCount === 'number' && skill.postingsCount > 0
        ? Math.min(skill.postingsCount, totalPostings)
        : finalJobIds.length;

      const calculatedFreq = typeof skill.frequencyPercent === 'number' && skill.frequencyPercent >= 0
        ? skill.frequencyPercent
        : (totalPostings > 0 ? Math.round((calculatedPostingsCount / totalPostings) * 100) : 50);

      return {
        ...skill,
        id: `gap-${Date.now()}-${index}`,
        candidateHas: skill.matchStatus === 'has',
        mentionedInJobIds: finalJobIds,
        postingsCount: calculatedPostingsCount,
        totalPostings,
        frequencyPercent: calculatedFreq
      };
    }).sort((a, b) => {
      const statusWeight = (status: CandidateMatchStatus) => {
        if (status === 'lacks') return 3;
        if (status === 'partly') return 2;
        return 1;
      };

      const weightDiff = statusWeight(b.matchStatus) - statusWeight(a.matchStatus);
      if (weightDiff !== 0) return weightDiff;
      // Secondary sort: highest frequency first
      return b.frequencyPercent - a.frequencyPercent;
    });

    return NextResponse.json({
      overallMatchPercentage: result.data.overallMatchPercentage ?? 55,
      criticalGapsCount: sortedSkills.filter(s => s.matchStatus === 'lacks' && s.frequencyPercent >= 50).length,
      skills: sortedSkills,
      lastAnalyzed: new Date().toISOString(),
      retried: result.retried,
      source: result.source,
      friendlyMessage: result.friendlyMessage
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message, friendlyMessage: 'An unexpected error occurred while mapping skill gaps.' },
      { status: 500 }
    );
  }
}
