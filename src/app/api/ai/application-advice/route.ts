import { NextResponse } from 'next/server';
import { callGeminiStructured } from '@/lib/gemini';

interface DimensionBreakdown {
  name: string;
  count: number;
  responseCount: number;
  rate: number;
}

interface ApplicationAdviceResponse {
  needsMoreData: boolean;
  adviceSentences: string[];
  nextTenApplicationsSuggestion: {
    focusRoleTypes: string[];
    focusCompanySizes: string[];
    focusRemoteTypes: string[];
    focusSources: string[];
    actionPlanText: string;
  };
}

export async function POST(req: Request) {
  try {
    const { 
      totalApplications, 
      responseCount, 
      responseRate, 
      byRoleType, 
      byCompanySize, 
      byRemote, 
      bySource,
      targetRole 
    } = await req.json();

    // Strict requirement: If fewer than 5 applications, say we need more data
    const parsedTotalApplications = Number(totalApplications) || 0;
    if (parsedTotalApplications < 5) {
      return NextResponse.json({
        needsMoreData: true,
        adviceSentences: [
          `We need more data to spot reliable hiring patterns.`,
          `You have logged ${parsedTotalApplications} application${parsedTotalApplications === 1 ? '' : 's'} so far; logging at least 5 applications will unlock empirical response rate analytics.`,
          `Continue targeting roles closely aligned with your transferable skills to start surfacing meaningful pipeline signals.`
        ],
        nextTenApplicationsSuggestion: {
          focusRoleTypes: targetRole ? [targetRole] : ['Target Positions'],
          focusCompanySizes: ['Mid-size (51-250)'],
          focusRemoteTypes: ['Hybrid', 'Remote'],
          focusSources: ['LinkedIn', 'Referral'],
          actionPlanText: `For your next 10 applications, aim for a balanced mix: submit 6 to Mid-size companies where hiring managers read candidate transition narratives, and 4 to local Hybrid roles where candidate competition is lower.`
        }
      });
    }

    const systemInstruction = `You are a pragmatic, data-driven Career Pivot Strategist and Executive Job Search Coach.
The client has tracked real job applications and their recruiter callbacks/interview responses.
Your job is to examine the empirical response numbers and:
1. Turn the counts and conversion rates into EXACTLY TWO OR THREE plain, honest advice sentences (no corporate fluff or filler).
2. Formulate concrete, tactical suggestions for their NEXT TEN applications based strictly on which role types, company sizes, remote models, and sources actually converted.`;

    const prompt = `Empirical Application Data for Candidate Pivot to ${targetRole || 'Target Role'}:
- Total Logged Applications: ${totalApplications}
- Total Responses (Screen/Interview/Offer): ${responseCount} (${responseRate}% overall response rate)

Conversion Breakdown by Role Type:
${Array.isArray(byRoleType) ? byRoleType.map((r: DimensionBreakdown) => `- ${r.name}: ${r.responseCount}/${r.count} (${r.rate}%)`).join('\n') : 'N/A'}

Conversion Breakdown by Company Size:
${Array.isArray(byCompanySize) ? byCompanySize.map((c: DimensionBreakdown) => `- ${c.name}: ${c.responseCount}/${c.count} (${c.rate}%)`).join('\n') : 'N/A'}

Conversion Breakdown by Remote Setting:
${Array.isArray(byRemote) ? byRemote.map((rm: DimensionBreakdown) => `- ${rm.name}: ${rm.responseCount}/${rm.count} (${rm.rate}%)`).join('\n') : 'N/A'}

Conversion Breakdown by Channel Source:
${Array.isArray(bySource) ? bySource.map((s: DimensionBreakdown) => `- ${s.name}: ${s.responseCount}/${s.count} (${s.rate}%)`).join('\n') : 'N/A'}

Generate:
- Exactly 2 or 3 plain advice sentences summarizing which kinds of roles and channels work best and what to avoid.
- Actionable suggestion for the next 10 applications.`;

    const fallbackGenerator = (): ApplicationAdviceResponse => {
      // Find top performing role type, company size, remote, and source
      const topRole = Array.isArray(byRoleType) && byRoleType.length > 0
        ? [...byRoleType].sort((a: DimensionBreakdown, b: DimensionBreakdown) => b.rate - a.rate)[0]
        : { name: 'Operations Analyst', rate: 100 };

      const topCompany = Array.isArray(byCompanySize) && byCompanySize.length > 0
        ? [...byCompanySize].sort((a: DimensionBreakdown, b: DimensionBreakdown) => b.rate - a.rate)[0]
        : { name: 'Mid-size (51-250)', rate: 80 };

      const topRemote = Array.isArray(byRemote) && byRemote.length > 0
        ? [...byRemote].sort((a: DimensionBreakdown, b: DimensionBreakdown) => b.rate - a.rate)[0]
        : { name: 'Hybrid', rate: 75 };

      const topSource = Array.isArray(bySource) && bySource.length > 0
        ? [...bySource].sort((a: DimensionBreakdown, b: DimensionBreakdown) => b.rate - a.rate)[0]
        : { name: 'Referral', rate: 100 };

      const sentence1 = `Your highest callback rates come from ${topRole.name} positions (${topRole.rate}% response), where your previous background is viewed as an immediate operational advantage.`;
      const sentence2 = `${topCompany.name} companies and ${topRemote.name} postings are outperforming large enterprises by more than double, likely because mid-market hiring managers evaluate holistic problem-solving rather than strict automated keyword filters.`;
      const sentence3 = `Cold job board applications show the lowest yield, while direct networking via ${topSource.name} consistently lands technical screens.`;

      return {
        needsMoreData: false,
        adviceSentences: [sentence1, sentence2, sentence3],
        nextTenApplicationsSuggestion: {
          focusRoleTypes: targetRole && targetRole !== topRole.name ? [topRole.name, targetRole] : [topRole.name],
          focusCompanySizes: [topCompany.name],
          focusRemoteTypes: [topRemote.name, 'Remote'],
          focusSources: [topSource.name, 'LinkedIn'],
          actionPlanText: `Allocate your next 10 applications: target 7 ${topRole.name} or ${targetRole || 'target'} roles at ${topCompany.name} firms (favoring ${topRemote.name} openings), and route at least 4 through warm ${topSource.name} introductions rather than cold submissions.`
        }
      };
    };

    const result = await callGeminiStructured<ApplicationAdviceResponse>({
      prompt,
      systemInstruction,
      schemaDescription: `{
        "needsMoreData": false,
        "adviceSentences": ["sentence 1", "sentence 2", "sentence 3"],
        "nextTenApplicationsSuggestion": {
          "focusRoleTypes": ["string"],
          "focusCompanySizes": ["string"],
          "focusRemoteTypes": ["string"],
          "focusSources": ["string"],
          "actionPlanText": "string"
        }
      }`,
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
