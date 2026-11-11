import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';
import { LearningPlan, LearningWeek, PlanChangeItem } from '@/types';
import { verifyAuth } from '@/lib/serverAuth';

interface AdjustPlanResponse {
  summary: string;
  rationale: string;
  changes: PlanChangeItem[];
  revisedPlan: LearningPlan;
}

export async function POST(req: Request) {
  const authResult = await verifyAuth(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  try {
    const { 
      learningPlan, 
      tasksFinishedCount, 
      totalTasksCount, 
      hoursStudied, 
      plannedHours, 
      interviewScores, 
      weakestSkills, 
      strongSkills,
      targetRole 
    } = await req.json();

    if (!learningPlan || !Array.isArray(learningPlan.weeks)) {
      return NextResponse.json({ error: 'Valid learning plan is required.' }, { status: 400 });
    }

    const isBehind = (hoursStudied < plannedHours * 0.75) || (tasksFinishedCount < totalTasksCount * 0.4);
    const hasHighInterviewScore = (typeof interviewScores?.recentScore === 'number' && interviewScores.recentScore >= 21) || (typeof interviewScores?.averageScore === 'number' && interviewScores.averageScore >= 20);

    const systemInstruction = `You are an elite Career Pivot Coach and Dynamic Learning Curriculum Architect.
You must adapt and calibrate an adult career transitioner's study plan based on their real execution data:
1. Execution Pace & Hours: Hours Studied (${hoursStudied} hrs) vs Planned (${plannedHours} hrs). Completed tasks: ${tasksFinishedCount}/${totalTasksCount}.
2. Interview Performance: Recent interview score ${typeof interviewScores?.recentScore === 'number' ? `${interviewScores.recentScore}/25` : 'N/A'}. Weakest criteria: ${interviewScores?.weakestCriterion || 'Technical Accuracy'}.
3. Skill Strengths: ${Array.isArray(strongSkills) ? strongSkills.join(', ') : 'Exploratory Analysis, Presentation'}.
4. Skill Gaps: ${Array.isArray(weakestSkills) ? weakestSkills.join(', ') : 'SQL Joins, BI Dashboards'}.

MANDATORY ADAPTATION RULES:
- If they are behind in hours or tasks: Stretch the timeline (e.g. increase weeks or redistribute load) OR trim low-priority theoretical tasks so they can focus on high-yield portfolio deliverables.
- If a skill scores well in interviews or proven tasks: Accelerate through that module or move on faster to save time.
- If a skill is weak (critical gap or low rubric score): Add targeted hands-on practice tasks and diagnostic drills.
- Detail every change in "changes" with: weekNumber, type ('extended' | 'accelerated' | 'trimmed' | 'added_practice' | 'modified'), description, and reason.
- Output the full "revisedPlan" object conforming to the LearningPlan schema.`;

    const prompt = `Current Plan Overview:
- Target Role: ${targetRole || 'Target Role'}
- Duration: ${learningPlan.durationWeeks} weeks, ${learningPlan.hoursPerWeek} hrs/week
- Status: ${isBehind ? 'BEHIND schedule on study hours/tasks' : 'ON TRACK with hours'}
- Hours Completed: ${hoursStudied} / ${plannedHours} planned hours
- Tasks Completed: ${tasksFinishedCount} / ${totalTasksCount} milestones
- Interview Readiness: Recent Score ${typeof interviewScores?.recentScore === 'number' ? `${interviewScores.recentScore}/25` : 'N/A'} (Average: ${typeof interviewScores?.averageScore === 'number' ? `${interviewScores.averageScore}/25` : 'N/A'})
- Active Plan Weeks:
${JSON.stringify(learningPlan.weeks, null, 2)}

Produce a revised, optimized learning plan reflecting these adaptations, accompanied by clear change rationale.`;

    const fallbackGenerator = (): AdjustPlanResponse => {
      // Deterministic intelligent plan adaptation
      const originalWeeks = learningPlan.weeks;
      const changes: PlanChangeItem[] = [];

      let newDurationWeeks = learningPlan.durationWeeks;
      let newHoursPerWeek = learningPlan.hoursPerWeek;

      // Rule 1: If behind, stretch timeline or trim
      if (isBehind) {
        newDurationWeeks = Math.min(learningPlan.durationWeeks + 1, 8);
        newHoursPerWeek = Math.max(Math.round(learningPlan.hoursPerWeek * 0.85), 6);
        changes.push({
          weekNumber: 1,
          type: 'extended',
          description: `Stretched curriculum from ${learningPlan.durationWeeks} weeks to ${newDurationWeeks} weeks, pacing workload at ${newHoursPerWeek} hours/week.`,
          reason: `Pacing calibration: You logged ${hoursStudied} hours vs ${plannedHours} planned. Stretching the timeline prevents burnout and ensures high-depth retention.`
        });
      }

      // Clone weeks
      const revisedWeeks: LearningWeek[] = originalWeeks.map((week: LearningWeek, idx: number) => {
        const weekNum = idx + 1;

        // Check matching skills dynamically
        const weekSkills = [...(week.targetSkills || []), week.theme].map(s => s.toLowerCase());
        const isMatchedStrong = Array.isArray(strongSkills) && strongSkills.some(s => 
          weekSkills.some(ws => ws.includes(s.toLowerCase()) || s.toLowerCase().includes(ws))
        );
        const matchingWeakSkill = Array.isArray(weakestSkills) ? weakestSkills.find(s => 
          weekSkills.some(ws => ws.includes(s.toLowerCase()) || s.toLowerCase().includes(ws))
        ) : null;

        // Rule 2: If skill scores well or matches candidate strength, accelerate
        if (hasHighInterviewScore && isMatchedStrong) {
          changes.push({
            weekNumber: weekNum,
            type: 'accelerated',
            description: `Accelerated review for ${week.theme}; trimmed basic definitions to jump straight into production deliverables.`,
            reason: `High interview validation${typeof interviewScores?.recentScore === 'number' ? ` (${interviewScores.recentScore}/25)` : ''} indicates strong grasp of baseline concepts.`
          });
          return {
            ...week,
            thingsToLearn: week.thingsToLearn.slice(0, 2),
            tasks: week.tasks.slice(0, 2),
            hoursNeeded: Math.max(week.hoursNeeded - 2, 4)
          };
        }

        // Rule 3: If week targets an identified skill gap, add practice
        if (matchingWeakSkill) {
          changes.push({
            weekNumber: weekNum,
            type: 'added_practice',
            description: `Added diagnostic practice drills for ${matchingWeakSkill} to solidify production readiness.`,
            reason: `Empirical gap analysis identified ${matchingWeakSkill} as a primary requirement across target job postings.`
          });
          return {
            ...week,
            thingsToLearn: [
              ...week.thingsToLearn,
              `Advanced production patterns and edge-case validation for ${matchingWeakSkill}`
            ],
            tasks: [
              ...week.tasks,
              {
                id: `extra-task-${weekNum}-1`,
                description: `Build hands-on diagnostic exercise verifying ${matchingWeakSkill} proficiency`,
                completed: false,
                skillTarget: matchingWeakSkill,
                estimatedHours: 2
              }
            ],
            hoursNeeded: week.hoursNeeded + 2
          };
        }

        // Rule 4: Trim low priorities if behind
        if (isBehind && week.tasks.length > 3) {
          changes.push({
            weekNumber: weekNum,
            type: 'trimmed',
            description: `Trimmed peripheral theoretical reading tasks; consolidated focus onto the core portfolio deliverable.`,
            reason: `Focusing remaining bandwidth directly on the prove-it milestone to protect portfolio momentum.`
          });
          return {
            ...week,
            tasks: week.tasks.slice(0, 2)
          };
        }

        return week;
      });

      // If we extended weeks, append a consolidation & mock onsite simulation week
      if (newDurationWeeks > originalWeeks.length) {
        revisedWeeks.push({
          weekNumber: newDurationWeeks,
          theme: 'Technical Capstone Integration & Live Interview Drills',
          targetSkills: ['End-to-End Analytics Workflow', 'Technical Interview Fluency'],
          thingsToLearn: [
            'Synthesizing multi-week artifacts into a cohesive GitHub portfolio case study',
            'Live whiteboarding and answering technical data challenges under time constraints'
          ],
          proveItTask: {
            id: `prove-${newDurationWeeks}`,
            description: 'Record an end-to-end 5-minute video walkthrough explaining your portfolio architecture to an executive stakeholder.',
            completed: false,
            estimatedHours: 4
          },
          hoursNeeded: newHoursPerWeek,
          tasks: [
            {
              id: `task-${newDurationWeeks}-1`,
              description: 'Conduct 2 mock technical interviews on your weakest gap (SQL window functions)',
              completed: false,
              skillTarget: 'Interview Fluency',
              estimatedHours: 2
            },
            {
              id: `task-${newDurationWeeks}-2`,
              description: 'Publish interactive portfolio dashboard link and write clean README documentation',
              completed: false,
              skillTarget: 'Executive Presentation',
              estimatedHours: 3
            }
          ]
        });
        changes.push({
          weekNumber: newDurationWeeks,
          type: 'extended',
          description: `Added Week ${newDurationWeeks}: 'Technical Capstone Integration & Live Interview Drills'.`,
          reason: `Provides dedicated buffer for mock interview defense and polishing your portfolio project before applying.`
        });
      }

      const summary = isBehind
        ? `Recalibrated timeline from ${learningPlan.durationWeeks} to ${newDurationWeeks} weeks to accommodate actual study pace (${hoursStudied} hrs logged), trimming secondary reading and adding targeted SQL practice.`
        : `Optimized plan based on strong mock interview validation: accelerated introductory modules and added advanced diagnostic drills for your weakest market skill gap.`;

      const interviewScoreClause = typeof interviewScores?.recentScore === 'number'
        ? ` and latest mock interview score (${interviewScores.recentScore}/25)`
        : '';
      const rationale = `Based on your ${hoursStudied} hours studied (vs ${plannedHours} planned)${interviewScoreClause}, the curriculum has been dynamically calibrated. Weak skill areas have received dedicated practical exercises, validated strengths have been accelerated, and the overall pacing has been adjusted to protect your transition velocity.`;

      return {
        summary,
        rationale,
        changes,
        revisedPlan: {
          ...learningPlan,
          durationWeeks: newDurationWeeks,
          hoursPerWeek: newHoursPerWeek,
          weeks: revisedWeeks,
          lastGenerated: new Date().toISOString()
        }
      };
    };

    const result = await callGeminiStructured<AdjustPlanResponse>({
      prompt,
      systemInstruction,
      schemaDescription: `{
        "summary": "string",
        "rationale": "string",
        "changes": [
          { "weekNumber": 1, "type": "extended", "description": "string", "reason": "string" }
        ],
        "revisedPlan": {
          "durationWeeks": 4,
          "hoursPerWeek": 10,
          "weeks": [],
          "portfolioProject": {},
          "lastGenerated": "string"
        }
      }`,
      fallbackGenerator,
      validate: (d: unknown) => {
        const r = d as AdjustPlanResponse;
        return !!r?.revisedPlan && Array.isArray(r.revisedPlan.weeks) && r.revisedPlan.weeks.length > 0 &&
          r.revisedPlan.weeks.every(w => typeof w?.theme === 'string' && Array.isArray(w.tasks) && Array.isArray(w.targetSkills)) &&
          Array.isArray(r.changes);
      }
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, friendlyMessage: result.friendlyMessage }, { status: 500 });
    }

    return NextResponse.json({
      ...result.data,
      revisedPlan: {
        ...learningPlan,
        ...result.data.revisedPlan,
        portfolioProject: result.data.revisedPlan.portfolioProject?.title ? result.data.revisedPlan.portfolioProject : learningPlan.portfolioProject,
        portfolioProjects: result.data.revisedPlan.portfolioProjects ?? learningPlan.portfolioProjects,
        durationWeeks: result.data.revisedPlan.weeks.length
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
