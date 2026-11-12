import { useSyncExternalStore, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import { AppState, OnboardingState, UserPreferences } from '@/types';

export const LEGACY_STORAGE_KEY = 'career_pivot_coach_state_v1';

let activeUserId: string | null = null;
let cachedRaw: string | null = null;
let cachedState: AppState | null = null;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { userId: string; state: AppState } | null = null;

export const DEFAULT_PREFERENCES: UserPreferences = {
  targetTimeline: '3-6 months',
  workMode: 'remote',
  preferredLocation: '',
};

export const DEFAULT_ONBOARDING: OnboardingState = {
  completed: false,
  currentStep: 1,
  completedAt: null,
};

export const INITIAL_EMPTY_STATE: AppState = {
  profile: {
    fullName: '',
    currentRole: '',
    industry: '',
    targetRole: '',
    yearsExperience: 0,
    rawSpeech: '',
    cleanedSpeech: '',
    skills: [],
    tools: [],
    responsibilities: [],
    achievements: [],
    transferableSkills: [],
    lastUpdated: '',
    preferences: DEFAULT_PREFERENCES,
    resumeFileName: '',
  },
  onboarding: DEFAULT_ONBOARDING,
  jobPostings: [],
  skillGapMap: {
    overallMatchPercentage: 0,
    skills: [],
    criticalGapsCount: 0,
    lastAnalyzed: '',
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
      milestones: [],
    },
    portfolioProjects: [],
    lastGenerated: '',
  },
  interviews: [],
  applications: [],
};

export function getUserStorageKey(userId: string | null): string {
  return userId ? `career_pivot_coach_state_${userId}` : LEGACY_STORAGE_KEY;
}

export function setActiveStorageUser(userId: string | null): void {
  if (userId === activeUserId) return;

  // Flush any pending write for the previous user before switching
  if (pendingSave && pendingSave.userId) {
    flushPendingSave();
  }

  // Reset in-memory cache when user changes so one person's data never shows up for another
  activeUserId = userId;
  cachedRaw = null;
  cachedState = null;
  notifyStorageSubscribers();
}

export function normalizeState(parsed: Partial<AppState> | null | undefined): AppState {
  if (!parsed || typeof parsed !== 'object') {
    return JSON.parse(JSON.stringify(INITIAL_EMPTY_STATE));
  }

  const profile = parsed.profile ? { ...parsed.profile } : { ...INITIAL_EMPTY_STATE.profile };
  if (!profile.preferences) {
    profile.preferences = { ...DEFAULT_PREFERENCES };
  }
  if (!Array.isArray(profile.skills)) profile.skills = [];
  if (!Array.isArray(profile.tools)) profile.tools = [];
  if (!Array.isArray(profile.responsibilities)) profile.responsibilities = [];
  if (!Array.isArray(profile.achievements)) profile.achievements = [];
  if (!Array.isArray(profile.transferableSkills)) profile.transferableSkills = [];

  const onboarding: OnboardingState = parsed.onboarding
    ? {
        completed: Boolean(parsed.onboarding.completed),
        currentStep: typeof parsed.onboarding.currentStep === 'number' ? parsed.onboarding.currentStep : 1,
        completedAt: parsed.onboarding.completedAt || null,
      }
    : { ...DEFAULT_ONBOARDING };

  const jobPostings = Array.isArray(parsed.jobPostings) ? parsed.jobPostings : [];
  const skillGapMap = parsed.skillGapMap ? { ...parsed.skillGapMap } : { ...INITIAL_EMPTY_STATE.skillGapMap };
  if (Array.isArray(skillGapMap.skills)) {
    skillGapMap.skills = skillGapMap.skills.map((s) => ({
      ...s,
      matchStatus: s.matchStatus || (s.candidateHas ? 'has' : 'lacks'),
      postingsCount: typeof s.postingsCount === 'number' ? s.postingsCount : s.mentionedInJobIds?.length || 1,
      totalPostings: typeof s.totalPostings === 'number' ? s.totalPostings : jobPostings.length || 3,
      provenPhrase: s.provenPhrase || 'Requirement verified across job postings',
      skillContext: s.skillContext || 'Industry standard competency required in target domain roles.',
      learningSuggestions: s.learningSuggestions || s.recommendation || 'Focus on hands-on project implementations.',
    }));
  }

  const learningPlan = parsed.learningPlan ? { ...parsed.learningPlan } : { ...INITIAL_EMPTY_STATE.learningPlan };
  if (typeof learningPlan.hoursPerWeek !== 'number') {
    learningPlan.hoursPerWeek = 10;
  }
  if (!Array.isArray(learningPlan.weeks)) {
    learningPlan.weeks = [];
  } else {
    learningPlan.weeks = learningPlan.weeks.map((w, idx) => ({
      ...w,
      thingsToLearn:
        Array.isArray(w.thingsToLearn) && w.thingsToLearn.length > 0
          ? w.thingsToLearn
          : [
              `Core conceptual foundations of ${w.theme || 'competency'}`,
              `Applied syntax, constraints, and standard query patterns`,
              `Practical validation and diagnostic testing`,
            ],
      proveItTask: w.proveItTask || {
        id: `prove-${w.weekNumber || idx + 1}`,
        description: w.tasks?.[0]?.description || `Build and document a functional proof artifact for ${w.theme}`,
        completed: false,
        estimatedHours: Math.max(Math.round((learningPlan.hoursPerWeek || 10) * 0.4), 3),
      },
      hoursNeeded: typeof w.hoursNeeded === 'number' ? w.hoursNeeded : learningPlan.hoursPerWeek || 10,
    }));
  }

  let planAdjustments = Array.isArray(parsed.planAdjustments) ? parsed.planAdjustments : [];
  // Firestore 1MB safety: keep only the last 3 plan adjustments
  if (planAdjustments.length > 3) {
    planAdjustments = planAdjustments.slice(-3);
  }

  let interviews = Array.isArray(parsed.interviews) ? parsed.interviews : [];
  interviews = interviews.map((i) => {
    if (!i.rubric && i.scores) {
      const s = i.scores;
      i.rubric = {
        relevance: { score: s.transferableEvidence || 4, reason: 'Evaluated relevance to the target position.' },
        structure: { score: s.starStructure || 4, reason: 'Follows structured STAR narrative.' },
        specificExamples: { score: s.transferableEvidence || 4, reason: 'Contains quantitative evidence.' },
        technicalAccuracy: { score: s.domainFluency || 3, reason: 'Demonstrates domain familiarity.' },
        clarity: { score: s.concisenessAndImpact || 4, reason: 'Clear and concise articulation.' },
        totalScore: Math.round(((s.totalScore || 16) / 20) * 25),
        maxScore: 25,
      };
      i.singleBiggestImprovement = i.feedback?.improvementAreas?.[0] || 'Incorporate more industry metrics and terminology.';
      i.strongerSampleAnswer = i.feedback?.suggestedBetterAnswer || i.userTranscript;
      i.attemptNumber = i.attemptNumber || 1;
    }
    return i;
  });

  let applications = Array.isArray(parsed.applications) ? parsed.applications : [];
  applications = applications.map((a, idx) => ({
    ...a,
    title: a.title || a.roleTitle || 'Data Analyst',
    roleTitle: a.roleTitle || a.title || 'Data Analyst',
    roleType:
      a.roleType ||
      (a.roleTitle?.includes('Operations')
        ? 'Operations Analyst'
        : a.roleTitle?.includes('BI')
        ? 'BI Analyst'
        : 'Data Analyst'),
    companySize: a.companySize || (idx % 2 === 0 ? 'Mid-size (51-250)' : 'Enterprise (250+)'),
    remote: a.remote || (idx % 3 === 0 ? 'Hybrid' : idx % 3 === 1 ? 'Remote' : 'On-site'),
    source: a.source || (idx % 2 === 0 ? 'LinkedIn' : 'Referral'),
    date: a.date || a.dateApplied || '2026-10-25',
    dateApplied: a.dateApplied || a.date || '2026-10-25',
    status: a.status || 'Applied',
  }));

  return {
    ...INITIAL_EMPTY_STATE,
    ...parsed,
    profile,
    onboarding,
    jobPostings,
    skillGapMap,
    learningPlan,
    interviews,
    applications,
    planAdjustments,
  };
}

export function getStoredState(): AppState {
  if (typeof window === 'undefined') {
    return INITIAL_EMPTY_STATE;
  }
  const key = getUserStorageKey(activeUserId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const emptyState = JSON.parse(JSON.stringify(INITIAL_EMPTY_STATE));
      const str = JSON.stringify(emptyState);
      localStorage.setItem(key, str);
      cachedRaw = str;
      cachedState = emptyState;
      return emptyState;
    }
    if (raw === cachedRaw && cachedState) {
      return cachedState;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);
    cachedRaw = raw;
    cachedState = normalized;
    return normalized;
  } catch (err) {
    console.error('Error reading localStorage state:', err);
    return INITIAL_EMPTY_STATE;
  }
}

export function saveStoredState(state: AppState): void {
  if (typeof window === 'undefined') return;

  const normalized = normalizeState(state);
  const key = getUserStorageKey(activeUserId);

  try {
    const raw = JSON.stringify(normalized);
    cachedRaw = raw;
    cachedState = normalized;
    localStorage.setItem(key, raw);
    notifyStorageSubscribers();
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }

  // Queue debounced write to Firestore for signed in users
  if (activeUserId && isFirebaseConfigured) {
    queueFirestoreSave(activeUserId, normalized);
  }
}

export function resetToEmptyState(): AppState {
  if (typeof window === 'undefined') return INITIAL_EMPTY_STATE;
  const empty = JSON.parse(JSON.stringify(INITIAL_EMPTY_STATE));
  saveStoredState(empty);
  return empty;
}

// Keep plan adjustments to last 3 to safely prevent exceeding Firestore 1MB limit
function sanitizeStateForFirestore(state: AppState): AppState {
  const cloned = JSON.parse(JSON.stringify(state)) as AppState;
  if (Array.isArray(cloned.planAdjustments) && cloned.planAdjustments.length > 3) {
    cloned.planAdjustments = cloned.planAdjustments.slice(-3);
  }
  return cloned;
}

function queueFirestoreSave(userId: string, state: AppState): void {
  pendingSave = { userId, state };

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    flushPendingSave();
  }, 1000);
}

export async function flushPendingSave(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (!pendingSave) return;

  const { userId, state } = pendingSave;
  pendingSave = null;

  if (!userId || !isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== userId) return;

  try {
    const sanitized = sanitizeStateForFirestore(state);
    const docRef = doc(db, 'users', userId, 'appState', 'main');
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Failed to sync state to Firestore:', err);
  }
}

// Flush pending writes on tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushPendingSave();
  });
  window.addEventListener('pagehide', () => {
    flushPendingSave();
  });
}

export function hasLegacyBrowserData(userId?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (userId) {
      const alreadyHandled =
        localStorage.getItem(`${LEGACY_STORAGE_KEY}_imported_${userId}`) ||
        localStorage.getItem(`${LEGACY_STORAGE_KEY}_declined_${userId}`);
      if (alreadyHandled) return false;
    }

    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const hasProfile = Boolean(
      parsed.profile?.fullName?.trim() ||
        parsed.profile?.currentRole?.trim() ||
        parsed.profile?.targetRole?.trim() ||
        (Array.isArray(parsed.profile?.skills) && parsed.profile.skills.length > 0)
    );
    const hasJobs = Array.isArray(parsed.jobPostings) && parsed.jobPostings.length > 0;
    const hasPlan = Array.isArray(parsed.learningPlan?.weeks) && parsed.learningPlan.weeks.length > 0;
    return hasProfile || hasJobs || hasPlan;
  } catch {
    return false;
  }
}

export function importLegacyBrowserData(userId: string): AppState {
  if (typeof window === 'undefined') return INITIAL_EMPTY_STATE;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const normalized = normalizeState(parsed);

    // Mark as onboarded if imported profile already has currentRole and targetRole
    if (normalized.profile.currentRole?.trim() && normalized.profile.targetRole?.trim()) {
      normalized.onboarding = {
        completed: true,
        currentStep: 4,
        completedAt: new Date().toISOString(),
      };
    }

    setActiveStorageUser(userId);
    saveStoredState(normalized);

    localStorage.setItem(`${LEGACY_STORAGE_KEY}_imported_${userId}`, 'true');
    return normalized;
  } catch (err) {
    console.error('Failed to import legacy browser data:', err);
    return INITIAL_EMPTY_STATE;
  }
}

export function declineLegacyImport(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${LEGACY_STORAGE_KEY}_declined_${userId}`, 'true');
  setActiveStorageUser(userId);
  saveStoredState(INITIAL_EMPTY_STATE);
}

export async function syncUserFromFirestore(userId: string): Promise<{ state: AppState; hasLegacyDataToImport: boolean }> {
  setActiveStorageUser(userId);

  // If Firebase is not configured, or if there is no matching active Firebase auth session (e.g. demo mode), use local fast cache
  if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== userId) {
    const localState = getStoredState();
    const hasLegacy = hasLegacyBrowserData(userId);
    return { state: localState, hasLegacyDataToImport: hasLegacy };
  }

  try {
    const docRef = doc(db, 'users', userId, 'appState', 'main');
    // Guard against network stalling with a 3.5s timeout race
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 3500)
    );
    const docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);

    if (docSnap && docSnap.exists()) {
      const data = docSnap.data() as AppState;
      const normalized = normalizeState(data);
      const key = getUserStorageKey(userId);
      const str = JSON.stringify(normalized);
      cachedRaw = str;
      cachedState = normalized;
      localStorage.setItem(key, str);
      notifyStorageSubscribers();
      return { state: normalized, hasLegacyDataToImport: false };
    } else {
      // User has no cloud data yet
      const hasLegacy = hasLegacyBrowserData(userId);
      if (hasLegacy) {
        const localCached = getStoredState();
        return { state: localCached, hasLegacyDataToImport: true };
      } else {
        // Fall back to empty state
        const empty = JSON.parse(JSON.stringify(INITIAL_EMPTY_STATE));
        saveStoredState(empty);
        return { state: empty, hasLegacyDataToImport: false };
      }
    }
  } catch (error) {
    console.warn('Error reading from Firestore (falling back to local cache):', error);
    const fallback = getStoredState();
    return { state: fallback, hasLegacyDataToImport: false };
  }
}

const storageSubscribers = new Set<() => void>();

function notifyStorageSubscribers(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('career_pivot_storage_updated'));
  }
  storageSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
}

function subscribeToStorage(callback: () => void) {
  storageSubscribers.add(callback);
  if (typeof window === 'undefined') {
    return () => storageSubscribers.delete(callback);
  }
  const handler = () => {
    cachedRaw = null;
    cachedState = null;
    callback();
  };
  window.addEventListener('career_pivot_storage_updated', handler);
  window.addEventListener('storage', handler);
  return () => {
    storageSubscribers.delete(callback);
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
