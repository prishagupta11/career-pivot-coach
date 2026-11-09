export type SkillCategory = 'Technical' | 'Domain' | 'Soft Skill' | 'Tool';
export type GapSeverity = 'Critical' | 'Moderate' | 'Good' | 'Strong';
export type CandidateMatchStatus = 'has' | 'partly' | 'lacks';
export type ApplicationStatus = 'Applied' | 'Screen' | 'Interview' | 'Rejected' | 'Offer';

export interface TransferableSkill {
  id: string;
  originalSkill: string;
  translatedSkill: string;
  category: SkillCategory;
  rationale: string;
  strengthLevel: 'Foundational' | 'Intermediate' | 'Advanced';
}

export interface UserProfile {
  fullName: string;
  currentRole: string;
  targetRole: string;
  yearsExperience: number;
  rawSpeech: string;
  cleanedSpeech: string;
  skills: string[];
  tools: string[];
  responsibilities: string[];
  achievements: string[];
  transferableSkills: TransferableSkill[];
  lastUpdated: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location?: string;
  rawText: string;
  extractedSkills: string[];
  dateAdded: string;
}

export interface SkillGapItem {
  id: string;
  skillName: string;
  category: SkillCategory;
  mentionedInJobIds: string[];
  postingsCount: number;
  totalPostings: number;
  frequencyPercent: number;
  candidateHas: boolean;
  matchStatus: CandidateMatchStatus;
  gapSeverity: GapSeverity;
  reason: string;
  provenPhrase: string;
  skillContext: string;
  learningSuggestions: string;
  recommendation: string;
}

export interface SkillGapMap {
  overallMatchPercentage: number;
  skills: SkillGapItem[];
  criticalGapsCount: number;
  lastAnalyzed: string;
  retried?: boolean;
  source?: string;
  friendlyMessage?: string;
}

export interface ProveItTask {
  id: string;
  description: string;
  completed: boolean;
  estimatedHours: number;
  deliverableProof?: string;
}

export interface LearningTask {
  id: string;
  description: string;
  completed: boolean;
  skillTarget: string;
  estimatedHours: number;
  resourceTitle?: string;
}

export interface LearningWeek {
  weekNumber: number;
  theme: string;
  targetSkills: string[];
  thingsToLearn: string[];
  proveItTask: ProveItTask;
  hoursNeeded: number;
  tasks: LearningTask[];
}

export interface PortfolioProject {
  title: string;
  tagline: string;
  problemStatement: string;
  demonstratedSkills: string[];
  deliverables: string[];
  milestones: string[];
}

export interface PortfolioProjectCard {
  id: string;
  title: string;
  tagline: string;
  problemSolved: string;
  gapsClosed: string[];
  stepByStepBuild: string[];
  resumeBullet: string;
  connectedWeeks: string;
  status?: 'Not Started' | 'In Progress' | 'Completed';
  demonstratedSkills?: string[];
  deliverables?: string[];
}

export interface LearningPlan {
  durationWeeks: number;
  hoursPerWeek: number;
  weeks: LearningWeek[];
  portfolioProject: PortfolioProject;
  portfolioProjects?: PortfolioProjectCard[];
  lastGenerated: string;
}

export interface RubricCriterion {
  score: number; // 1-5
  reason: string; // One-sentence reason
}

export interface FivePartRubric {
  relevance: RubricCriterion;
  structure: RubricCriterion;
  specificExamples: RubricCriterion;
  technicalAccuracy: RubricCriterion;
  clarity: RubricCriterion;
  totalScore: number; // 5 - 25
  maxScore: number; // 25
}

export interface InterviewRubricScore {
  transferableEvidence: number; // 0-5
  starStructure: number;        // 0-5
  domainFluency: number;        // 0-5
  concisenessAndImpact: number; // 0-5
  totalScore: number;           // 0-20
}

export interface InterviewRecord {
  id: string;
  date: string;
  timestamp?: number;
  question: string;
  questionType: 'technical' | 'behavioral';
  targetSkill?: string;
  userTranscript: string;
  rawTranscript?: string;
  cleanedTranscript?: string;
  rubric: FivePartRubric;
  singleBiggestImprovement: string;
  strongerSampleAnswer: string;
  attemptNumber: number;
  previousScore?: number;
  scoreDelta?: number;
  targetCompetency?: string;
  scores?: InterviewRubricScore;
  feedback?: {
    strengths: string[];
    improvementAreas: string[];
    suggestedBetterAnswer: string;
  };
}

export type CompanySize = 'Startup (1-50)' | 'Mid-size (51-250)' | 'Enterprise (250+)';
export type WorkLocation = 'Remote' | 'Hybrid' | 'On-site';
export type ApplicationSource = 'LinkedIn' | 'Referral' | 'Company Website' | 'Cold Outreach' | 'Job Board';

export interface JobApplication {
  id: string;
  company: string;
  title: string;
  roleTitle?: string; // backward compatibility
  roleType: string;
  companySize: CompanySize | string;
  remote: WorkLocation | string;
  source: ApplicationSource | string;
  date: string;
  dateApplied?: string; // backward compatibility
  status: ApplicationStatus;
  matchedSkillScore?: number;
  notes?: string;
}

export interface PlanChangeItem {
  weekNumber: number;
  type: 'extended' | 'accelerated' | 'trimmed' | 'added_practice' | 'modified';
  description: string;
  reason: string;
}

export interface PlanAdjustmentRecord {
  id: string;
  date: string;
  summary: string;
  rationale: string;
  changes: PlanChangeItem[];
  previousPlan: LearningPlan;
  revisedPlan: LearningPlan;
}

export interface AppState {
  profile: UserProfile;
  jobPostings: JobPosting[];
  skillGapMap: SkillGapMap;
  learningPlan: LearningPlan;
  previousPlan?: LearningPlan;
  planAdjustments?: PlanAdjustmentRecord[];
  interviews: InterviewRecord[];
  applications: JobApplication[];
}
