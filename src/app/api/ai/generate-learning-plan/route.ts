import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';
import { UserProfile, SkillGapItem } from '@/types';

interface GeneratePlanPayload {
  durationWeeks: number;
  hoursPerWeek: number;
  weeks: Array<{
    weekNumber: number;
    theme: string;
    targetSkills: string[];
    thingsToLearn: string[];
    proveItTask: {
      id: string;
      description: string;
      completed: boolean;
      estimatedHours: number;
      deliverableProof: string;
    };
    hoursNeeded: number;
    tasks: Array<{
      id: string;
      description: string;
      completed: boolean;
      skillTarget: string;
      estimatedHours: number;
    }>;
  }>;
  portfolioProjects: Array<{
    id: string;
    title: string;
    tagline: string;
    problemSolved: string;
    gapsClosed: string[];
    stepByStepBuild: string[];
    resumeBullet: string;
    connectedWeeks: string;
    status: 'Not Started' | 'In Progress' | 'Completed';
  }>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawHours = Number(body.hoursPerWeek);
    const rawWeeks = Number(body.durationWeeks);
    const hoursPerWeek = Number.isFinite(rawHours) ? Math.min(40, Math.max(1, Math.round(rawHours))) : 10;
    const durationWeeks = Number.isFinite(rawWeeks) ? Math.min(24, Math.max(1, Math.round(rawWeeks))) : 4;
    const {
      skillGaps = [],
      profile
    } = body as {
      skillGaps: SkillGapItem[];
      profile: UserProfile;
    };

    const targetRole = profile?.targetRole || 'Junior Data Analyst';
    const missingGaps = skillGaps.filter(g => g.matchStatus === 'lacks' || g.matchStatus === 'partly');
    const prioritizedGapNames = (missingGaps.length > 0 ? missingGaps : skillGaps)
      .map(g => `${g.skillName} (${g.frequencyPercent}% demand in postings - Status: ${g.matchStatus})`)
      .slice(0, 6);

    const systemInstruction = `You are a Principal Technical Career Transition Architect for "Career Pivot Coach".
Your goal is to build an empirical, week-by-week learning plan and portfolio project roadmap based on the candidate's biggest skill gaps.

CRITICAL INSTRUCTIONS:
1. ORDER BY BIGGEST GAPS FIRST:
   - Prioritize the most demanded missing skills in Week 1 and Week 2 (e.g. SQL, Relational Architecture, Data Modeling).
   - Subsequent weeks tackle secondary gaps (e.g. BI Dashboards, Python, Automated Cleansing).
2. WEEKLY STRUCTURE (Must strictly match for all ${durationWeeks} weeks):
   - "theme": Engaging, descriptive title for the week.
   - "targetSkills": 2 to 4 specific skills addressed.
   - "thingsToLearn": Exactly 2 or 3 concrete conceptual topics/skills to learn.
   - "proveItTask": Exactly ONE small, demonstrable task that proves competency for that week, with:
     * "id": string
     * "description": Practical, deliverable-driven task description
     * "completed": false
     * "estimatedHours": integer around 30-40% of weekly hours
     * "deliverableProof": Name of the tangible artifact (e.g. "cohort_retention.sql published to GitHub", "Live Tableau dashboard link")
   - "hoursNeeded": Total hours for the week (must equal ${hoursPerWeek}).
   - "tasks": 3 interactive, bite-sized tasks (including the prove-it task) whose estimatedHours sum up to ${hoursPerWeek}.
3. THREE STRATEGIC PORTFOLIO PROJECTS:
   - Provide exactly 3 distinct portfolio projects designed to prove the missing skills to hiring managers.
   - For EACH project:
     * "title": High-impact enterprise title.
     * "tagline": One sentence summary.
     * "problemSolved": Realistic business problem statement.
     * "gapsClosed": Array of specific missing skills it proves.
     * "stepByStepBuild": 4 chronological, numbered milestone steps of what to build.
     * "resumeBullet": One crisp, quantifiable resume bullet ready to paste on a resume.
     * "connectedWeeks": Explain which weeks in the learning plan it connects to (e.g. "Fits into Weeks 1 & 2").
     * "status": "Not Started"

Return strictly valid JSON matching the requested schema.`;

    const prompt = `CANDIDATE PIVOT CONTEXT:
- Target Role: ${targetRole}
- Current Background: ${profile?.currentRole || 'Teacher'} (${profile?.yearsExperience || 5} years)
- Allocated Time: ${hoursPerWeek} hours per week across ${durationWeeks} weeks
- Identified Market Skill Gaps (Biggest Gaps First):
${prioritizedGapNames.join('\n') || 'SQL, Tableau/Power BI, Python for Data Analysis'}

Generate a custom ${durationWeeks}-week plan and 3 portfolio projects.
Respond ONLY with this JSON schema:
{
  "durationWeeks": ${durationWeeks},
  "hoursPerWeek": ${hoursPerWeek},
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "string",
      "targetSkills": ["string"],
      "thingsToLearn": ["concept 1", "concept 2", "concept 3"],
      "proveItTask": {
        "id": "prove-w1",
        "description": "string",
        "completed": false,
        "estimatedHours": 4,
        "deliverableProof": "string"
      },
      "hoursNeeded": ${hoursPerWeek},
      "tasks": [
        {
          "id": "w1-t1",
          "description": "string",
          "completed": false,
          "skillTarget": "string",
          "estimatedHours": 3
        }
      ]
    }
  ],
  "portfolioProjects": [
    {
      "id": "proj-1",
      "title": "string",
      "tagline": "string",
      "problemSolved": "string",
      "gapsClosed": ["string"],
      "stepByStepBuild": ["step 1", "step 2", "step 3", "step 4"],
      "resumeBullet": "string",
      "connectedWeeks": "Fits into Weeks 1 & 2",
      "status": "Not Started"
    }
  ]
}`;

    const fallbackGenerator = (): GeneratePlanPayload => {
      const h1 = Math.max(Math.floor(hoursPerWeek * 0.3), 2);
      const h2 = Math.max(Math.floor(hoursPerWeek * 0.3), 2);
      const h3 = Math.max(hoursPerWeek - (h1 + h2), 3);

      const generatedWeeks: GeneratePlanPayload['weeks'] = [];

      for (let i = 1; i <= durationWeeks; i++) {
        if (i === 1) {
          generatedWeeks.push({
            weekNumber: 1,
            theme: 'Relational Database Architecture & Production SQL Querying',
            targetSkills: ['SQL Syntax', 'Relational Schemas', 'Multi-Table JOINs', 'Aggregations'],
            thingsToLearn: [
              'Relational database schemas, primary/foreign key relationships, and tabular constraints',
              'Multi-table INNER, LEFT, and RIGHT JOIN logic with filter boundaries (WHERE vs. HAVING)',
              'Aggregations (COUNT, SUM, AVG) combined with GROUP BY and ORDER BY sorting'
            ],
            proveItTask: {
              id: 'prove-w1',
              description: 'Write and execute 15 multi-table PostgreSQL queries on a public retail database calculating cohort revenue metrics, and publish the SQL script to GitHub.',
              completed: false,
              estimatedHours: h3,
              deliverableProof: 'retail_cohort_queries.sql published to GitHub repo'
            },
            hoursNeeded: hoursPerWeek,
            tasks: [
              {
                id: 'w1-t1',
                description: 'Complete PostgreSQL interactive query drills (30 practice exercises on Mode Analytics)',
                completed: false,
                skillTarget: 'SQL Syntax',
                estimatedHours: h1
              },
              {
                id: 'w1-t2',
                description: 'Practice multi-table INNER and LEFT JOINs on sample retail databases',
                completed: false,
                skillTarget: 'Relational Joins',
                estimatedHours: h2
              },
              {
                id: 'w1-t3',
                description: 'Execute 15 multi-table PostgreSQL queries calculating cohort metrics and save script',
                completed: false,
                skillTarget: 'SQL Query Architecture',
                estimatedHours: h3
              }
            ]
          });
        } else if (i === 2) {
          generatedWeeks.push({
            weekNumber: 2,
            theme: 'Advanced SQL: CTEs, Subqueries & Window Functions',
            targetSkills: ['Common Table Expressions (CTEs)', 'Window Functions (RANK, DENSE_RANK)', 'Data Hygiene'],
            thingsToLearn: [
              'Common Table Expressions (WITH clauses) for clean, modular multi-step analytics',
              'Analytical window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), and LAG()/LEAD()',
              'Handling missing data, NULL value coercion (COALESCE), and string manipulations in SQL'
            ],
            proveItTask: {
              id: 'prove-w2',
              description: 'Build a modular SQL script using CTEs and window functions to compute month-over-month customer retention curves.',
              completed: false,
              estimatedHours: h3,
              deliverableProof: 'customer_retention_window_functions.sql with CTE pipeline'
            },
            hoursNeeded: hoursPerWeek,
            tasks: [
              {
                id: 'w2-t1',
                description: 'Master Common Table Expressions (WITH clauses) for modular query design',
                completed: false,
                skillTarget: 'CTEs',
                estimatedHours: h1
              },
              {
                id: 'w2-t2',
                description: 'Solve 15 LeetCode / HackerRank SQL medium-difficulty problems focusing on window functions',
                completed: false,
                skillTarget: 'Window Functions',
                estimatedHours: h2
              },
              {
                id: 'w2-t3',
                description: 'Construct end-to-end retention cohort script using CTEs and LEAD/LAG window metrics',
                completed: false,
                skillTarget: 'Advanced SQL Modeling',
                estimatedHours: h3
              }
            ]
          });
        } else if (i === 3) {
          generatedWeeks.push({
            weekNumber: 3,
            theme: 'Interactive Executive Dashboarding in Tableau / Power BI',
            targetSkills: ['Tableau / Power BI', 'Data Modeling', 'Calculated Fields', 'Visual Storytelling'],
            thingsToLearn: [
              'Connecting BI tools (Tableau Public / Power BI) to SQL exports and building star-schema data models',
              'Writing calculated fields, LOD expressions (or DAX measures), and parameter-driven toggles',
              'Applying 5-second visual hierarchy principles: executive KPI summary cards, time series trends, and drill-down breakdowns'
            ],
            proveItTask: {
              id: 'prove-w3',
              description: 'Publish an interactive Tableau Public dashboard featuring KPI cards, dynamic date filtering, and drill-down tooltips.',
              completed: false,
              estimatedHours: h3,
              deliverableProof: 'Live interactive Tableau Public web link'
            },
            hoursNeeded: hoursPerWeek,
            tasks: [
              {
                id: 'w3-t1',
                description: 'Connect Tableau Public to clean SQL export datasets and configure dimension relationships',
                completed: false,
                skillTarget: 'BI Visualization',
                estimatedHours: h1
              },
              {
                id: 'w3-t2',
                description: 'Build calculated fields and dynamic parameter filters for period-over-period variance',
                completed: false,
                skillTarget: 'Calculated Fields',
                estimatedHours: h2
              },
              {
                id: 'w3-t3',
                description: 'Finalize high-contrast executive summary dashboard with interactive tooltip drilldowns',
                completed: false,
                skillTarget: 'Visual Storytelling',
                estimatedHours: h3
              }
            ]
          });
        } else if (i === 4) {
          generatedWeeks.push({
            weekNumber: 4,
            theme: 'Python Data Wrangling (Pandas) & Automated Cleansing',
            targetSkills: ['Python (Pandas)', 'Automated Cleansing', 'Data Validation', 'ETL Scripting'],
            thingsToLearn: [
              'Importing, filtering, and sanitizing multi-source CSV/JSON files using Python and Pandas',
              'Handling missing data, duplicate records, and exporting clean tabular data into PostgreSQL',
              'Structuring automated data validation scripts with unit sanity checks'
            ],
            proveItTask: {
              id: 'prove-w4',
              description: 'Build and run a Python script using Pandas that cleans raw messy CSV logs and loads structured tables into PostgreSQL.',
              completed: false,
              estimatedHours: h3,
              deliverableProof: 'clean_pipeline.py with automated data validation tests'
            },
            hoursNeeded: hoursPerWeek,
            tasks: [
              {
                id: 'w4-t1',
                description: 'Write a modular Python script using Pandas to sanitize and validate raw datasets',
                completed: false,
                skillTarget: 'Python / Pandas',
                estimatedHours: h1
              },
              {
                id: 'w4-t2',
                description: 'Automate duplicate detection, null-value imputations, and datatype coercion in Python',
                completed: false,
                skillTarget: 'Automated Cleansing',
                estimatedHours: h2
              },
              {
                id: 'w4-t3',
                description: 'Export sanitized tables into PostgreSQL and verify relational integrity with sample queries',
                completed: false,
                skillTarget: 'ETL Pipeline Integration',
                estimatedHours: h3
              }
            ]
          });
        } else {
          // Dynamic cycling through actual identified skill gaps for 6- or 8-week plans
          const gapPool = missingGaps.length > 0 ? missingGaps : skillGaps;
          const assignedGap = gapPool.length > 0 ? gapPool[(i - 1) % gapPool.length] : null;
          const assignedSkillName = assignedGap?.skillName || (
            i === 5 ? 'Statistical Analysis & Experimentation' :
            i === 6 ? 'Cloud Data Warehousing & Architecture' :
            i === 7 ? 'Executive Data Storytelling & Presentation' :
            'Comprehensive Portfolio Capstone'
          );
          const assignedSuggestion = assignedGap?.learningSuggestions || `Implement end-to-end production workflows in ${assignedSkillName}.`;

          generatedWeeks.push({
            weekNumber: i,
            theme: `Deep Dive & Mastery: ${assignedSkillName}`,
            targetSkills: [assignedSkillName, 'Applied Problem Solving', 'Enterprise Best Practices'],
            thingsToLearn: [
              `Core principles and industrial patterns for ${assignedSkillName}`,
              `Diagnostic error-handling and metric validation in ${assignedSkillName}`,
              `Translating quantitative outcomes from ${assignedSkillName} into stakeholder decision impact`
            ],
            proveItTask: {
              id: `prove-w${i}`,
              description: `Deliver a verifiable project artifact demonstrating competency in ${assignedSkillName}: ${assignedSuggestion}`,
              completed: false,
              estimatedHours: h3,
              deliverableProof: `Production deliverable and documentation verifying ${assignedSkillName} proficiency`
            },
            hoursNeeded: hoursPerWeek,
            tasks: [
              {
                id: `w${i}-t1`,
                description: `Study enterprise specifications and key methodologies for ${assignedSkillName}`,
                completed: false,
                skillTarget: assignedSkillName,
                estimatedHours: h1
              },
              {
                id: `w${i}-t2`,
                description: `Complete targeted practical exercises: ${assignedSuggestion}`,
                completed: false,
                skillTarget: `${assignedSkillName} Application`,
                estimatedHours: h2
              },
              {
                id: `w${i}-t3`,
                description: `Construct and test prove-it milestone verifying applied skill in ${assignedSkillName}`,
                completed: false,
                skillTarget: `${assignedSkillName} Proof`,
                estimatedHours: h3
              }
            ]
          });
        }
      }

      return {
        durationWeeks,
        hoursPerWeek,
        weeks: generatedWeeks,
        portfolioProjects: [
          {
            id: 'proj-1',
            title: 'E-Commerce Customer Retention & Cohort Analytics Engine',
            tagline: 'PostgreSQL analytical database pipeline uncovering customer drop-off curves and revenue retention trends.',
            problemSolved: 'Direct-to-consumer e-commerce companies suffer steep month-over-month customer churn, but lack visibility into which acquisition cohorts drop off fastest. Without granular cohort retention tables, marketing and product leadership misallocate ad spend.',
            gapsClosed: [
              'SQL (PostgreSQL / Relational Queries)',
              'Advanced CTEs & Window Functions',
              'KPI Benchmarking & Retention Metrics'
            ],
            stepByStepBuild: [
              'Step 1: Database Setup — Set up PostgreSQL local instance and ingest 250,000+ real transaction records into structured orders and customers tables.',
              'Step 2: Relational Queries — Construct multi-table relational joins to calculate customer lifetime spend, average order frequency, and purchase latency.',
              'Step 3: Churn Cohort Model — Write Common Table Expressions (CTEs) and window functions (ROW_NUMBER, DENSE_RANK, LAG) to group users by sign-up cohort and measure retention curves.',
              'Step 4: GitHub Documentation — Package clean SQL scripts, entity-relationship diagrams (ERD), and an executive summary memo into a polished public GitHub repository.'
            ],
            resumeBullet: 'Engineered PostgreSQL cohort retention pipeline across 250k+ transactions using SQL CTEs & window functions, identifying an 18% churn drop-off point for executive decision-makers.',
            connectedWeeks: 'Fits into Weeks 1 & 2 (Relational Database & Advanced SQL)',
            status: 'Not Started'
          },
          {
            id: 'proj-2',
            title: 'Executive Healthcare Operations KPI Dashboard',
            tagline: 'Interactive Tableau Public executive operations portal tracking patient wait times, capacity thresholds, and clinical SLAs.',
            problemSolved: 'Healthcare operational leaders struggle with fragmented spreadsheets that fail to provide real-time alerts on emergency department congestion and staffing bottlenecks, delaying clinical interventions.',
            gapsClosed: [
              'BI Dashboard Visualization (Tableau or Power BI)',
              'Data Storytelling & Executive Alignment',
              'Metric Definition & SLA Benchmarking'
            ],
            stepByStepBuild: [
              'Step 1: Data Cleansing — Standardize raw clinical visit logs in Excel/SQL, creating structured date dimensions and patient wait time metrics.',
              'Step 2: Visual Wireframe — Layout dashboard wireframe following cognitive hierarchy principles: high-level KPI cards at the top, trend lines in the center, and department drill-downs at the bottom.',
              'Step 3: Calculated Fields & Interactivity — Develop dynamic parameter controls, period-over-period variance formulas, and custom tooltip drilldowns.',
              'Step 4: Executive Walkthrough — Publish to Tableau Public, configure mobile-friendly layouts, and record a 2-minute Loom presentation walking through key operational bottlenecks.'
            ],
            resumeBullet: 'Designed interactive Tableau executive operations dashboard with custom drill-down filters and calculated variance metrics, reducing weekly executive reporting prep time by 40%.',
            connectedWeeks: 'Fits into Week 3 (Interactive Dashboarding & Visual Storytelling)',
            status: 'Not Started'
          },
          {
            id: 'proj-3',
            title: 'Automated Multi-Source Data Ingestion & Cleansing Engine',
            tagline: 'Production-style Python/Pandas data validation pipeline standardizing multi-vendor data feeds into analytics-ready schemas.',
            problemSolved: 'Analytics teams lose 15+ hours every week manually reconciling inconsistent vendor spreadsheets, fixing broken date formats, and identifying corrupted null entries before SQL ingestion.',
            gapsClosed: [
              'Python for Data Analysis (Pandas & Scripting)',
              'Data Validation & Schema Hygiene',
              'Automated ETL Workflows'
            ],
            stepByStepBuild: [
              'Step 1: Environment & Ingestion — Configure Python virtual environment and write modular Pandas ingestion scripts to handle messy CSV/JSON inputs.',
              'Step 2: Cleaning & Normalization — Standardize column headers, parse non-uniform timestamps, impute missing values, and eliminate duplicate transaction records.',
              'Step 3: Automated Validation — Implement assertion rules that validate column datatypes, check foreign key integrity, and flag transactions exceeding 3 standard deviations.',
              'Step 4: Summary Export & CLI — Output clean tabular datasets ready for PostgreSQL loading and auto-generate an executive data hygiene report.'
            ],
            resumeBullet: 'Developed automated Python/Pandas data validation pipeline that cleans, normalizes, and reconciles multi-source records, eliminating 15 hours of recurring manual spreadsheet work weekly.',
            connectedWeeks: `Fits into Week ${Math.min(4, durationWeeks)} (Automation, Scripting & Portfolio Finalization)`,
            status: 'Not Started'
          }
        ]
      };
    };

    const result = await callGeminiStructured<GeneratePlanPayload>({
      prompt,
      systemInstruction,
      schemaDescription: '{ "durationWeeks": 4, "hoursPerWeek": 10, "weeks": [], "portfolioProjects": [] }',
      validate: (d: unknown) => {
        const p = d as GeneratePlanPayload;
        return Array.isArray(p?.weeks) && p.weeks.length > 0 &&
          p.weeks.every(w => typeof w?.theme === 'string' && Array.isArray(w.targetSkills) && Array.isArray(w.tasks)) &&
          Array.isArray(p.portfolioProjects);
      },
      fallbackGenerator
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, friendlyMessage: result.friendlyMessage || 'Unable to generate plan.' },
        { status: 500 }
      );
    }

    const firstProject = result.data.portfolioProjects?.[0];
    const primaryPortfolioProject = {
      title: firstProject?.title || 'Capstone Transition Portfolio Project',
      tagline: firstProject?.tagline || 'Production-grade case study demonstrating mastery of target domain skills.',
      problemStatement: firstProject?.problemSolved || 'Demonstrating practical data analytics and workflow problem solving.',
      demonstratedSkills: firstProject?.gapsClosed || ['SQL', 'Data Analytics', 'BI Visualization'],
      deliverables: firstProject?.stepByStepBuild || [firstProject?.resumeBullet || 'Portfolio GitHub repository and dashboard'],
      milestones: firstProject?.stepByStepBuild || []
    };

    return NextResponse.json({
      durationWeeks: result.data.durationWeeks,
      hoursPerWeek: result.data.hoursPerWeek,
      weeks: result.data.weeks,
      portfolioProject: primaryPortfolioProject,
      portfolioProjects: result.data.portfolioProjects,
      lastGenerated: new Date().toISOString(),
      retried: result.retried,
      source: result.source,
      friendlyMessage: result.friendlyMessage
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message, friendlyMessage: 'An unexpected error occurred while generating learning plan.' },
      { status: 500 }
    );
  }
}
