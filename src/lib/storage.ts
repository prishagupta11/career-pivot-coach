import { useSyncExternalStore, useCallback } from 'react';
import { AppState } from '@/types';

const STORAGE_KEY = 'career_pivot_coach_state_v1';

let cachedRaw: string | null = null;
let cachedState: AppState | null = null;

export const INITIAL_EMPTY_STATE: AppState = {
  profile: {
    fullName: '',
    currentRole: '',
    targetRole: '',
    yearsExperience: 0,
    rawSpeech: '',
    cleanedSpeech: '',
    skills: [],
    tools: [],
    responsibilities: [],
    achievements: [],
    transferableSkills: [],
    lastUpdated: ''
  },
  jobPostings: [],
  skillGapMap: {
    overallMatchPercentage: 0,
    skills: [],
    criticalGapsCount: 0,
    lastAnalyzed: ''
  },
  learningPlan: {
    durationWeeks: 4,
    hoursPerWeek: 10,
    weeks: [],
    portfolioProject: {
      title: '',
      tagline: '',
      problemStatement: '',
      demonstratedSkills: [],
      deliverables: [],
      milestones: []
    },
    portfolioProjects: [],
    lastGenerated: ''
  },
  interviews: [],
  applications: []
};

export function getStoredState(): AppState {
  if (typeof window === 'undefined') {
    return INITIAL_EMPTY_STATE; // Fallback during SSR
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with empty state by default
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EMPTY_STATE));
      cachedRaw = JSON.stringify(INITIAL_EMPTY_STATE);
      cachedState = INITIAL_EMPTY_STATE;
      return INITIAL_EMPTY_STATE;
    }
    if (raw === cachedRaw && cachedState) {
      return cachedState;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.profile) {
      if (!Array.isArray(parsed.profile.skills)) parsed.profile.skills = [];
      if (!Array.isArray(parsed.profile.tools)) parsed.profile.tools = [];
    }
    if (parsed.skillGapMap && Array.isArray(parsed.skillGapMap.skills)) {
      parsed.skillGapMap.skills = parsed.skillGapMap.skills.map(s => ({
        ...s,
        matchStatus: s.matchStatus || (s.candidateHas ? 'has' : 'lacks'),
        postingsCount: typeof s.postingsCount === 'number' ? s.postingsCount : (s.mentionedInJobIds?.length || 1),
        totalPostings: typeof s.totalPostings === 'number' ? s.totalPostings : (parsed.jobPostings?.length || 3),
        provenPhrase: s.provenPhrase || 'Requirement verified across job postings',
        skillContext: s.skillContext || 'Industry standard competency required in target domain roles.',
        learningSuggestions: s.learningSuggestions || s.recommendation || 'Focus on hands-on project implementations.'
      }));
    }
    if (parsed.learningPlan) {
      if (typeof parsed.learningPlan.hoursPerWeek !== 'number') {
        parsed.learningPlan.hoursPerWeek = 10;
      }
      if (!Array.isArray(parsed.learningPlan.weeks)) {
        parsed.learningPlan.weeks = [];
      } else {
        parsed.learningPlan.weeks = parsed.learningPlan.weeks.map((w, idx) => ({
          ...w,
          thingsToLearn: Array.isArray(w.thingsToLearn) && w.thingsToLearn.length > 0 ? w.thingsToLearn : [
            `Core conceptual foundations of ${w.theme || 'competency'}`,
            `Applied syntax, constraints, and standard query patterns`,
            `Practical validation and diagnostic testing`
          ],
          proveItTask: w.proveItTask || {
            id: `prove-${w.weekNumber || idx + 1}`,
            description: w.tasks?.[0]?.description || `Build and document a functional proof artifact for ${w.theme}`,
            completed: false,
            estimatedHours: Math.max(Math.round((parsed.learningPlan.hoursPerWeek || 10) * 0.4), 3)
          },
          hoursNeeded: typeof w.hoursNeeded === 'number' ? w.hoursNeeded : (parsed.learningPlan.hoursPerWeek || 10)
        }));
      }
    }
    if (parsed.interviews && Array.isArray(parsed.interviews)) {
      parsed.interviews = parsed.interviews.map(i => {
        if (!i.rubric && i.scores) {
          const s = i.scores;
          i.rubric = {
            relevance: { score: s.transferableEvidence || 4, reason: 'Evaluated relevance to the target position.' },
            structure: { score: s.starStructure || 4, reason: 'Follows structured STAR narrative.' },
            specificExamples: { score: s.transferableEvidence || 4, reason: 'Contains quantitative evidence.' },
            technicalAccuracy: { score: s.domainFluency || 3, reason: 'Demonstrates domain familiarity.' },
            clarity: { score: s.concisenessAndImpact || 4, reason: 'Clear and concise articulation.' },
            totalScore: Math.round(((s.totalScore || 16) / 20) * 25),
            maxScore: 25
          };
          i.singleBiggestImprovement = i.feedback?.improvementAreas?.[0] || 'Incorporate more industry metrics and terminology.';
          i.strongerSampleAnswer = i.feedback?.suggestedBetterAnswer || i.userTranscript;
          i.attemptNumber = i.attemptNumber || 1;
        }
        return i;
      });
    }
    if (parsed.applications && Array.isArray(parsed.applications)) {
      parsed.applications = parsed.applications.map((a, idx) => ({
        ...a,
        title: a.title || a.roleTitle || 'Data Analyst',
        roleTitle: a.roleTitle || a.title || 'Data Analyst',
        roleType: a.roleType || (a.roleTitle?.includes('Operations') ? 'Operations Analyst' : a.roleTitle?.includes('BI') ? 'BI Analyst' : 'Data Analyst'),
        companySize: a.companySize || (idx % 2 === 0 ? 'Mid-size (51-250)' : 'Enterprise (250+)'),
        remote: a.remote || (idx % 3 === 0 ? 'Hybrid' : idx % 3 === 1 ? 'Remote' : 'On-site'),
        source: a.source || (idx % 2 === 0 ? 'LinkedIn' : 'Referral'),
        date: a.date || a.dateApplied || '2026-10-25',
        dateApplied: a.dateApplied || a.date || '2026-10-25',
        status: a.status || 'Applied'
      }));
    }
    cachedRaw = raw;
    cachedState = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading localStorage state:', err);
    return INITIAL_EMPTY_STATE;
  }
}

export function saveStoredState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.stringify(state);
    cachedRaw = raw;
    cachedState = state;
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event('career_pivot_storage_updated'));
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
}

export function resetToEmptyState(): AppState {
  if (typeof window === 'undefined') return INITIAL_EMPTY_STATE;
  const raw = JSON.stringify(INITIAL_EMPTY_STATE);
  cachedRaw = raw;
  cachedState = INITIAL_EMPTY_STATE;
  localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event('career_pivot_storage_updated'));
  return INITIAL_EMPTY_STATE;
}

function subscribeToStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    cachedRaw = null;
    cachedState = null;
    callback();
  };
  window.addEventListener('career_pivot_storage_updated', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('career_pivot_storage_updated', handler);
    window.removeEventListener('storage', handler);
  };
}

export function useAppState(): [AppState, (updater: AppState | ((prev: AppState) => AppState)) => void] {
  const state = useSyncExternalStore(
    subscribeToStorage,
    getStoredState,
    () => INITIAL_EMPTY_STATE
  );

  const setAppState = useCallback((updater: AppState | ((prev: AppState) => AppState)) => {
    const currentState = getStoredState();
    const nextState = typeof updater === 'function' ? updater(currentState) : updater;
    saveStoredState(nextState);
  }, []);

  return [state, setAppState];
}
